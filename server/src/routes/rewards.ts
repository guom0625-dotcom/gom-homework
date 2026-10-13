import { ulid } from 'ulid';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPE } from '../lib/gems.ts';
import { sendPush } from '../lib/push.ts';

interface CatalogRow {
    id: string;
    manager_id: string;
    title: string;
    description: string | null;
    cost: number;
    kind: 'once' | 'always';
}

interface OwnedRow {
    id: string;
    student_id: string;
    catalog_id: string;
    title: string;
    status: 'owned' | 'use_requested' | 'used';
}

// 보상 구매 → 보유 → 사용 요청 → 매니저 사용 완료
export function registerRewardRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    const pushToken = (userId: string): string | null | undefined =>
        (db.prepare('SELECT push_token FROM users WHERE id = ?').get(userId) as
            { push_token: string | null } | undefined)?.push_token;

    const userName = (userId: string): string =>
        (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string }).name;

    // POST /catalog/:id/buy  (student only — 다이아를 바로 차감하고 보상을 보유)
    app.post('/catalog/:id/buy', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        type BuyResult = { ok: false; error: string; code: number } | { ok: true; item: CatalogRow; ownedId: string };
        const result = db.transaction((): BuyResult => {
            const item = db.prepare(`
                SELECT rc.* FROM reward_catalog rc
                JOIN manager_student_link l ON l.manager_id = rc.manager_id
                WHERE rc.id = ? AND rc.active = 1 AND l.student_id = ?
            `).get(id, req.user.id) as CatalogRow | undefined;
            if (!item) return { ok: false, error: 'catalog_item_not_found', code: 404 };

            const balance = db.prepare(
                'SELECT diamond FROM gems_balance WHERE student_id = ?'
            ).get(req.user.id) as { diamond: number } | undefined;
            if (!balance || balance.diamond < item.cost) return { ok: false, error: 'insufficient_gems', code: 409 };

            const ownedId = ulid();
            const now = Date.now();
            db.prepare('UPDATE gems_balance SET diamond = diamond - ?, updated_at = ? WHERE student_id = ?')
                .run(item.cost, now, req.user.id);
            db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, ?, ?, 'purchase', ?, ?)
            `).run(ulid(), req.user.id, GEM_TYPE, -item.cost, ownedId, now);
            db.prepare(`
                INSERT INTO owned_rewards (id, student_id, catalog_id, title, description, cost, status, purchased_at)
                VALUES (?, ?, ?, ?, ?, ?, 'owned', ?)
            `).run(ownedId, req.user.id, item.id, item.title, item.description, item.cost, now);
            // 1회성 보상은 팔리면 상점에서 내린다
            if (item.kind === 'once') {
                db.prepare('UPDATE reward_catalog SET active = 0 WHERE id = ?').run(item.id);
            }
            return { ok: true, item, ownedId };
        })();

        if (!result.ok) return reply.code(result.code).send({ error: result.error });

        await sendPush(pushToken(result.item.manager_id), {
            title: `${userName(req.user.id)}가 보상을 구매했어요`,
            body: result.item.title,
            data: { type: 'reward_purchased', reward_id: result.ownedId },
        });

        return reply.code(201).send(db.prepare('SELECT * FROM owned_rewards WHERE id = ?').get(result.ownedId));
    });

    // GET /rewards?status=xxx  (student: 내 보유 보상 / manager: 연결된 학생들의 보유 보상)
    app.get('/rewards', { preHandler: auth }, async (req) => {
        const { status } = req.query as { status?: string };
        const params: unknown[] = [req.user.id];

        let sql = req.user.role === 'student'
            ? 'SELECT o.* FROM owned_rewards o WHERE o.student_id = ?'
            : `SELECT o.*, u.name AS student_name
               FROM owned_rewards o
               JOIN users u ON u.id = o.student_id
               JOIN manager_student_link l ON l.student_id = o.student_id
               WHERE l.manager_id = ?`;
        if (status) { sql += ' AND o.status = ?'; params.push(status); }
        sql += ' ORDER BY o.purchased_at DESC';

        return db.prepare(sql).all(...params);
    });

    // POST /rewards/:id/use  (student only — 보유 보상 사용 요청)
    app.post('/rewards/:id/use', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const reward = db.prepare(
            'SELECT * FROM owned_rewards WHERE id = ? AND student_id = ?'
        ).get(id, req.user.id) as OwnedRow | undefined;
        if (!reward) return reply.code(404).send({ error: 'not_found' });
        if (reward.status !== 'owned') return reply.code(409).send({ error: 'cannot_use' });

        db.prepare(
            "UPDATE owned_rewards SET status = 'use_requested', use_requested_at = ? WHERE id = ?"
        ).run(Date.now(), id);

        const manager = db.prepare(
            'SELECT manager_id FROM manager_student_link WHERE student_id = ?'
        ).get(req.user.id) as { manager_id: string } | undefined;
        await sendPush(manager && pushToken(manager.manager_id), {
            title: `${userName(req.user.id)}가 보상을 쓰고 싶어해요`,
            body: reward.title,
            data: { type: 'reward_use_requested', reward_id: id },
        });

        return { ok: true };
    });

    // POST /rewards/:id/complete  (manager only — 실제로 보상을 해준 뒤 사용 완료 처리)
    app.post('/rewards/:id/complete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const reward = db.prepare('SELECT * FROM owned_rewards WHERE id = ?').get(id) as OwnedRow | undefined;
        if (!reward) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, reward.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        if (reward.status !== 'use_requested') return reply.code(409).send({ error: 'not_use_requested' });

        db.prepare("UPDATE owned_rewards SET status = 'used', used_at = ? WHERE id = ?").run(Date.now(), id);

        await sendPush(pushToken(reward.student_id), {
            title: '보상 사용 완료!',
            body: reward.title,
            data: { type: 'reward_used', reward_id: id },
        });

        return { ok: true };
    });
}
