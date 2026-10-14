import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPE } from '../lib/gems.ts';
import { FURNITURE_PRICES } from '../lib/furniture.ts';

// 방 바닥은 ROOM_SIZE x ROOM_SIZE 칸. 가구가 몇 칸을 차지하는지는 앱이 알고 겹침 검사도 앱이 한다 —
// 서버는 칸 번호가 방 안인지만 확인한다.
export const ROOM_SIZE = 20;
const DEFAULT_STYLE = { wall: 'cream', floor: 'wood' };

const BuyBody = z.object({ item_key: z.string().max(50) });

const LayoutBody = z.object({
    items: z.array(z.object({
        id: z.string(),
        placed: z.boolean(),
        x: z.number().int().min(0).max(ROOM_SIZE - 1),
        z: z.number().int().min(0).max(ROOM_SIZE - 1),
        rot: z.number().int().min(0).max(3),
    })).min(1).max(300),
});

const StyleBody = z.object({
    wall: z.string().regex(/^[a-z0-9_-]{1,20}$/),
    floor: z.string().regex(/^[a-z0-9_-]{1,20}$/),
});

// 미니룸: 가구 구매(다이아·루비 차감 → 창고) / 창고에서 꺼내 배치 / 벽지·바닥
export function registerRoomRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    const isLinked = (managerId: string, studentId: string): boolean =>
        !!db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(managerId, studentId);

    const roomOf = (studentId: string) => {
        const style = db.prepare('SELECT wall, floor FROM room_style WHERE student_id = ?')
            .get(studentId) as { wall: string; floor: string } | undefined;
        const items = db.prepare(`
            SELECT id, item_key, placed, x, z, rot, bought_at FROM room_items
            WHERE student_id = ? ORDER BY bought_at DESC
        `).all(studentId) as { placed: number }[];
        return {
            size: ROOM_SIZE,
            wall: style?.wall ?? DEFAULT_STYLE.wall,
            floor: style?.floor ?? DEFAULT_STYLE.floor,
            items: items.map(i => ({ ...i, placed: i.placed === 1 })),
        };
    };

    // GET /room  (student: 내 방 / manager: ?student_id= 학생 방 구경)
    app.get('/room', { preHandler: auth }, async (req, reply) => {
        if (req.user.role === 'student') return roomOf(req.user.id);
        const { student_id } = req.query as { student_id?: string };
        if (!student_id || !isLinked(req.user.id, student_id)) return reply.code(403).send({ error: 'forbidden' });
        return roomOf(student_id);
    });

    // POST /room/buy  (student only — 바로 차감하고 창고에 넣는다)
    app.post('/room/buy', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = BuyBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const key = parsed.data.item_key;
        const price = Object.hasOwn(FURNITURE_PRICES, key) ? FURNITURE_PRICES[key] : undefined;
        if (!price) return reply.code(404).send({ error: 'item_not_found' });

        const result = db.transaction((): string | null => {
            const balance = db.prepare(
                'SELECT diamond, ruby FROM gems_balance WHERE student_id = ?'
            ).get(req.user.id) as { diamond: number; ruby: number } | undefined;
            if (!balance || balance.diamond < price.cost || balance.ruby < price.ruby) return null;

            const id = ulid();
            const now = Date.now();
            db.prepare(
                'UPDATE gems_balance SET diamond = diamond - ?, ruby = ruby - ?, updated_at = ? WHERE student_id = ?'
            ).run(price.cost, price.ruby, now, req.user.id);
            const logSpend = db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, ?, ?, 'furniture', ?, ?)
            `);
            if (price.cost > 0) logSpend.run(ulid(), req.user.id, GEM_TYPE, -price.cost, id, now);
            if (price.ruby > 0) logSpend.run(ulid(), req.user.id, 'ruby', -price.ruby, id, now);
            db.prepare(`
                INSERT INTO room_items (id, student_id, item_key, cost, cost_ruby, bought_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, req.user.id, key, price.cost, price.ruby, now, now);
            return id;
        })();
        if (!result) return reply.code(409).send({ error: 'insufficient_gems' });

        const item = db.prepare(
            'SELECT id, item_key, placed, x, z, rot, bought_at FROM room_items WHERE id = ?'
        ).get(result) as { placed: number };
        return reply.code(201).send({ ...item, placed: item.placed === 1 });
    });

    // PUT /room/items  (student only — 배치·방향·창고 넣기를 한꺼번에 저장)
    app.put('/room/items', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = LayoutBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

        const now = Date.now();
        const update = db.prepare(`
            UPDATE room_items SET placed = ?, x = ?, z = ?, rot = ?, updated_at = ?
            WHERE id = ? AND student_id = ?
        `);
        const missing = db.transaction(() => {
            let miss = 0;
            for (const i of parsed.data.items) {
                const r = update.run(i.placed ? 1 : 0, i.x, i.z, i.rot, now, i.id, req.user.id);
                if (r.changes === 0) miss++;
            }
            return miss;
        })();
        if (missing > 0) return reply.code(404).send({ error: 'item_not_found' });
        return { ok: true };
    });

    // PUT /room/style  (student only — 벽지·바닥 색. 무료)
    app.put('/room/style', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = StyleBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        db.prepare(`
            INSERT INTO room_style (student_id, wall, floor, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET wall = excluded.wall, floor = excluded.floor, updated_at = excluded.updated_at
        `).run(req.user.id, parsed.data.wall, parsed.data.floor, Date.now());
        return { ok: true };
    });
}
