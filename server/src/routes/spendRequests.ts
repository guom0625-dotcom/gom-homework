import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPES, type GemBalance, canAfford } from '../lib/gems.ts';
import { sendPush } from '../lib/push.ts';

const CreateBody = z.object({
    catalog_id: z.string(),
});

export function registerSpendRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /spend-requests
    app.get('/spend-requests', { preHandler: auth }, async (req, reply) => {
        if (req.user.role === 'student') {
            return db.prepare(`
                SELECT sr.*, rc.title AS catalog_title
                FROM spend_requests sr
                JOIN reward_catalog rc ON rc.id = sr.catalog_id
                WHERE sr.student_id = ?
                ORDER BY sr.created_at DESC
            `).all(req.user.id);
        }

        // manager: see all pending requests from linked students
        const { student_id, status } = req.query as { student_id?: string; status?: string };
        let sql = `
            SELECT sr.*, rc.title AS catalog_title, u.name AS student_name
            FROM spend_requests sr
            JOIN reward_catalog rc ON rc.id = sr.catalog_id
            JOIN users u ON u.id = sr.student_id
            JOIN manager_student_link l ON l.student_id = sr.student_id
            WHERE l.manager_id = ?
        `;
        const params: unknown[] = [req.user.id];
        if (student_id) { sql += ' AND sr.student_id = ?'; params.push(student_id); }
        if (status) { sql += ' AND sr.status = ?'; params.push(status); }
        sql += ' ORDER BY sr.created_at DESC';

        return db.prepare(sql).all(...params);
    });

    // POST /spend-requests  (student only)
    app.post('/spend-requests', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const body = CreateBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const item = db.prepare(
            'SELECT * FROM reward_catalog WHERE id = ? AND active = 1'
        ).get(body.data.catalog_id) as (Record<string, number> & { id: string; title: string; manager_id: string }) | undefined;
        if (!item) return reply.code(404).send({ error: 'catalog_item_not_found' });

        const balance = db.prepare(
            'SELECT * FROM gems_balance WHERE student_id = ?'
        ).get(req.user.id) as GemBalance | undefined;
        if (!balance) return reply.code(400).send({ error: 'no_balance' });

        const cost: Partial<GemBalance> = {};
        for (const g of GEM_TYPES) {
            const v = item[`cost_${g}` as keyof typeof item] as number ?? 0;
            if (v > 0) cost[g] = v;
        }
        if (!canAfford(balance, cost)) return reply.code(409).send({ error: 'insufficient_gems' });

        const id = ulid();
        const now = Date.now();
        db.prepare(
            'INSERT INTO spend_requests (id, student_id, catalog_id, status, created_at) VALUES (?, ?, ?, \'pending\', ?)'
        ).run(id, req.user.id, body.data.catalog_id, now);

        const manager = db.prepare('SELECT push_token FROM users WHERE id = ?').get(item.manager_id) as
            { push_token: string | null } | undefined;
        const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id) as { name: string };
        await sendPush(manager?.push_token, {
            title: `${student.name}가 보상을 요청했어요`,
            body: item.title,
            data: { type: 'spend_request', request_id: id },
        });

        return reply.code(201).send(db.prepare('SELECT * FROM spend_requests WHERE id = ?').get(id));
    });

    // POST /spend-requests/:id/approve  (manager only)
    app.post('/spend-requests/:id/approve', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const req_ = db.prepare(`
            SELECT sr.*, rc.cost_topaz, rc.cost_emerald, rc.cost_sapphire, rc.cost_ruby, rc.cost_amethyst,
                   rc.title AS catalog_title
            FROM spend_requests sr
            JOIN reward_catalog rc ON rc.id = sr.catalog_id
            WHERE sr.id = ? AND sr.status = 'pending'
        `).get(id) as (Record<string, number> & { student_id: string; catalog_title: string }) | undefined;

        if (!req_) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, req_.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        const balance = db.prepare('SELECT * FROM gems_balance WHERE student_id = ?').get(req_.student_id) as GemBalance;
        const cost: Partial<GemBalance> = {};
        for (const g of GEM_TYPES) {
            const v = req_[`cost_${g}` as keyof typeof req_] as number ?? 0;
            if (v > 0) cost[g] = v;
        }
        if (!canAfford(balance, cost)) return reply.code(409).send({ error: 'insufficient_gems' });

        const now = Date.now();
        const tx = db.transaction(() => {
            db.prepare(
                'UPDATE spend_requests SET status = \'approved\', reviewed_at = ? WHERE id = ?'
            ).run(now, id);

            for (const g of GEM_TYPES) {
                const v = req_[`cost_${g}` as keyof typeof req_] as number ?? 0;
                if (v > 0) {
                    db.prepare(`UPDATE gems_balance SET ${g} = ${g} - ?, updated_at = ? WHERE student_id = ?`)
                        .run(v, now, req_.student_id);
                    db.prepare(`
                        INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                        VALUES (?, ?, ?, ?, 'spend_approve', ?, ?)
                    `).run(ulid(), req_.student_id, g, -v, id, now);
                }
            }
        });
        tx();

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(req_.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
            title: '보상 승인!',
            body: req_.catalog_title,
            data: { type: 'spend_approved', request_id: id },
        });

        return { ok: true };
    });

    // POST /spend-requests/:id/reject  (manager only)
    app.post('/spend-requests/:id/reject', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const req_ = db.prepare(
            'SELECT * FROM spend_requests WHERE id = ? AND status = \'pending\''
        ).get(id) as { student_id: string; catalog_id: string } | undefined;
        if (!req_) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, req_.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        db.prepare(
            'UPDATE spend_requests SET status = \'rejected\', reviewed_at = ? WHERE id = ?'
        ).run(Date.now(), id);

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(req_.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
            title: '보상 요청이 거절됐어요',
            body: '매니저에게 문의하세요',
            data: { type: 'spend_rejected', request_id: id },
        });

        return { ok: true };
    });
}
