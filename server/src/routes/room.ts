import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPE } from '../lib/gems.ts';
import { FURNITURE_PRICES } from '../lib/furniture.ts';
import { WEAR_SLOTS, WEAR_PRICES, DEFAULT_OUTFIT } from '../lib/wear.ts';

// 방 바닥은 ROOM_SIZE x ROOM_SIZE 칸. 가구가 몇 칸을 차지하는지는 앱이 알고 겹침 검사도 앱이 한다 —
// 서버는 칸 번호가 방 안인지만 확인한다.
export const ROOM_SIZE = 16;
const DEFAULT_STYLE = { wall: 'cream', floor: 'wood' };

const BuyBody = z.object({ item_key: z.string().max(50) });

// 다이아 1개 = 토파즈 10개
export const TOPAZ_PER_DIAMOND = 10;
const ExchangeBody = z.object({ diamonds: z.number().int().min(1).max(1000) });

const LayoutBody = z.object({
    items: z.array(z.object({
        id: z.string(),
        placed: z.boolean(),
        x: z.number().int().min(0).max(ROOM_SIZE - 1),
        z: z.number().int().min(0).max(ROOM_SIZE - 1),
        rot: z.number().int().min(0).max(3),
    })).min(1).max(300),
});

// 미니미 옷차림 — 옷 종류는 목록에 있는 것만, 색은 #RRGGBB
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const slot = <K extends keyof typeof WEAR_SLOTS>(k: K) =>
    z.enum(Object.keys(WEAR_SLOTS[k]) as [string, ...string[]]);
const OutfitBody = z.object({
    body: z.enum(['female', 'male']),
    skin: color, hair: color, topColor: color, bottomColor: color,
    top: slot('top'), bottom: slot('bottom'), shoes: slot('shoes'), glasses: slot('glasses'), hat: slot('hat'),
});

// 미니미 위치는 가구 배치와 같이 저장한다 (id = 'avatar')
export const AVATAR_ID = 'avatar';

const StyleBody = z.object({
    wall: z.string().regex(/^[a-z0-9_-]{1,20}$/),
    floor: z.string().regex(/^[a-z0-9_-]{1,20}$/),
});

// 미니룸: 가구 구매(토파즈 차감 → 창고) / 다이아 → 토파즈 교환 / 창고에서 꺼내 배치 / 벽지·바닥
export function registerRoomRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    const isLinked = (managerId: string, studentId: string): boolean =>
        !!db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(managerId, studentId);

    // 미니미·옷을 저장하기 전에 room_style 줄이 있게
    const ensureStyle = (studentId: string, now: number) => {
        db.prepare(`
            INSERT INTO room_style (student_id, wall, floor, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id) DO NOTHING
        `).run(studentId, DEFAULT_STYLE.wall, DEFAULT_STYLE.floor, now);
    };

    const roomOf = (studentId: string) => {
        const style = db.prepare(`
            SELECT wall, floor, avatar, avatar_x, avatar_z, avatar_rot FROM room_style WHERE student_id = ?
        `).get(studentId) as {
            wall: string; floor: string; avatar: string | null;
            avatar_x: number | null; avatar_z: number | null; avatar_rot: number;
        } | undefined;
        const wear = db.prepare('SELECT item_key FROM owned_wear WHERE student_id = ?')
            .all(studentId) as { item_key: string }[];
        const items = db.prepare(`
            SELECT id, item_key, placed, x, z, rot, bought_at FROM room_items
            WHERE student_id = ? ORDER BY bought_at DESC
        `).all(studentId) as { placed: number }[];
        return {
            size: ROOM_SIZE,
            wall: style?.wall ?? DEFAULT_STYLE.wall,
            floor: style?.floor ?? DEFAULT_STYLE.floor,
            items: items.map(i => ({ ...i, placed: i.placed === 1 })),
            avatar: {
                outfit: style?.avatar ? JSON.parse(style.avatar) : DEFAULT_OUTFIT,
                x: style?.avatar_x ?? null,   // null = 아직 안 놓음 → 앱이 가운데에 놓는다
                z: style?.avatar_z ?? null,
                rot: style?.avatar_rot ?? 2,
            },
            wear: wear.map(w => w.item_key),   // 산 옷
        };
    };

    // GET /room  (student: 내 방 / manager: ?student_id= 학생 방 구경)
    app.get('/room', { preHandler: auth }, async (req, reply) => {
        if (req.user.role === 'student') return roomOf(req.user.id);
        const { student_id } = req.query as { student_id?: string };
        if (!student_id || !isLinked(req.user.id, student_id)) return reply.code(403).send({ error: 'forbidden' });
        return roomOf(student_id);
    });

    // POST /room/buy  (student only — 토파즈를 바로 차감하고 창고에 넣는다)
    app.post('/room/buy', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = BuyBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const key = parsed.data.item_key;
        const price = Object.hasOwn(FURNITURE_PRICES, key) ? FURNITURE_PRICES[key] : undefined;
        if (price === undefined) return reply.code(404).send({ error: 'item_not_found' });

        const result = db.transaction((): string | null => {
            const balance = db.prepare('SELECT topaz FROM gems_balance WHERE student_id = ?')
                .get(req.user.id) as { topaz: number } | undefined;
            if (!balance || balance.topaz < price) return null;

            const id = ulid();
            const now = Date.now();
            db.prepare('UPDATE gems_balance SET topaz = topaz - ?, updated_at = ? WHERE student_id = ?')
                .run(price, now, req.user.id);
            if (price > 0) {
                db.prepare(`
                    INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                    VALUES (?, ?, 'topaz', ?, 'furniture', ?, ?)
                `).run(ulid(), req.user.id, -price, id, now);
            }
            db.prepare(`
                INSERT INTO room_items (id, student_id, item_key, cost_topaz, bought_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, req.user.id, key, price, now, now);
            return id;
        })();
        if (!result) return reply.code(409).send({ error: 'insufficient_gems' });

        const item = db.prepare(
            'SELECT id, item_key, placed, x, z, rot, bought_at FROM room_items WHERE id = ?'
        ).get(result) as { placed: number };
        return reply.code(201).send({ ...item, placed: item.placed === 1 });
    });

    // POST /room/exchange  (student only — 다이아 → 토파즈. 반대 방향은 없다)
    app.post('/room/exchange', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = ExchangeBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const { diamonds } = parsed.data;
        const topaz = diamonds * TOPAZ_PER_DIAMOND;

        const ok = db.transaction((): boolean => {
            const balance = db.prepare('SELECT diamond FROM gems_balance WHERE student_id = ?')
                .get(req.user.id) as { diamond: number } | undefined;
            if (!balance || balance.diamond < diamonds) return false;
            const now = Date.now();
            const ref = ulid();
            db.prepare(
                'UPDATE gems_balance SET diamond = diamond - ?, topaz = topaz + ?, updated_at = ? WHERE student_id = ?'
            ).run(diamonds, topaz, now, req.user.id);
            const log = db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, ?, ?, 'exchange', ?, ?)
            `);
            log.run(ulid(), req.user.id, GEM_TYPE, -diamonds, ref, now);
            log.run(ulid(), req.user.id, 'topaz', topaz, ref, now);
            return true;
        })();
        if (!ok) return reply.code(409).send({ error: 'insufficient_gems' });

        const balance = db.prepare('SELECT diamond, ruby, topaz FROM gems_balance WHERE student_id = ?')
            .get(req.user.id) as { diamond: number; ruby: number; topaz: number };
        return { diamonds: balance.diamond, rubies: balance.ruby, topaz: balance.topaz };
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
                if (i.id === AVATAR_ID) {
                    ensureStyle(req.user.id, now);
                    db.prepare(`
                        UPDATE room_style SET avatar_x = ?, avatar_z = ?, avatar_rot = ?, updated_at = ?
                        WHERE student_id = ?
                    `).run(i.x, i.z, i.rot, now, req.user.id);
                    continue;
                }
                const r = update.run(i.placed ? 1 : 0, i.x, i.z, i.rot, now, i.id, req.user.id);
                if (r.changes === 0) miss++;
            }
            return miss;
        })();
        if (missing > 0) return reply.code(404).send({ error: 'item_not_found' });
        return { ok: true };
    });

    // POST /room/wear/buy  (student only — 옷을 토파즈로 산다. 한 번 사면 계속)
    app.post('/room/wear/buy', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = BuyBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const key = parsed.data.item_key;
        const price = Object.hasOwn(WEAR_PRICES, key) ? WEAR_PRICES[key] : undefined;
        if (price === undefined) return reply.code(404).send({ error: 'item_not_found' });

        const result = db.transaction((): 'ok' | 'owned' | 'poor' => {
            if (db.prepare('SELECT 1 FROM owned_wear WHERE student_id = ? AND item_key = ?').get(req.user.id, key)) {
                return 'owned';
            }
            const balance = db.prepare('SELECT topaz FROM gems_balance WHERE student_id = ?')
                .get(req.user.id) as { topaz: number } | undefined;
            if (!balance || balance.topaz < price) return 'poor';
            const now = Date.now();
            db.prepare('UPDATE gems_balance SET topaz = topaz - ?, updated_at = ? WHERE student_id = ?')
                .run(price, now, req.user.id);
            db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, 'topaz', ?, 'wear', ?, ?)
            `).run(ulid(), req.user.id, -price, key, now);
            db.prepare('INSERT INTO owned_wear (student_id, item_key, cost_topaz, bought_at) VALUES (?, ?, ?, ?)')
                .run(req.user.id, key, price, now);
            return 'ok';
        })();
        if (result === 'owned') return reply.code(409).send({ error: 'already_owned' });
        if (result === 'poor') return reply.code(409).send({ error: 'insufficient_gems' });
        const balance = db.prepare('SELECT topaz FROM gems_balance WHERE student_id = ?')
            .get(req.user.id) as { topaz: number };
        return reply.code(201).send({ item_key: key, topaz: balance.topaz });
    });

    // PUT /room/avatar  (student only — 옷 갈아입기. 산 옷과 기본 옷만)
    app.put('/room/avatar', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = OutfitBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const o = parsed.data;
        const owned = new Set((db.prepare('SELECT item_key FROM owned_wear WHERE student_id = ?')
            .all(req.user.id) as { item_key: string }[]).map(w => w.item_key));
        for (const key of [o.top, o.bottom, o.shoes, o.glasses, o.hat]) {
            if (Object.hasOwn(WEAR_PRICES, key) && !owned.has(key)) {
                return reply.code(409).send({ error: 'not_owned', item_key: key });
            }
        }
        const now = Date.now();
        ensureStyle(req.user.id, now);
        db.prepare('UPDATE room_style SET avatar = ?, updated_at = ? WHERE student_id = ?')
            .run(JSON.stringify(o), now, req.user.id);
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
