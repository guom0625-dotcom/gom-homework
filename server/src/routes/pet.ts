import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';

// 펫 앱(gomTamagotchi)
// - 밥: 하루 1번 토파즈 3개. 먹고 3시간·8시간 뒤에 똥이 하나씩 나온다
// - 쓰다듬기(알이면 품어주기): 하루 1번, 무료
// - 청소: 무료. 그날 똥을 하나라도 치우면 '청소한 날'
// - 성장: 단계마다 조건(연속 일수·방 크기)을 모두 채우면 아이가 성장 버튼을 누른다
export const FEED_PRICE = 3;
const FULL = 3;                          // 배부름 칸 수. 밥을 주면 가득, 하루마다 1칸씩 준다
const POOP_AFTER_H = [3, 8];
const ROOM_PRICES = [30, 60];            // 작은 방 → 중간 방 → 큰 방
const MAX_ROOM = ROOM_PRICES.length;

type Stage = 'egg' | 'baby' | 'teen' | 'adult';
type Cond = 'feed' | 'pat' | 'clean' | 'room';
// 다음 단계로 가는 조건. feed·pat·clean 은 지금 단계에서의 연속 일수, room 은 방 크기
const GROWTH: Record<Exclude<Stage, 'adult'>, { next: Stage; need: Partial<Record<Cond, number>> }> = {
    egg: { next: 'baby', need: { pat: 2 } },
    baby: { next: 'teen', need: { feed: 5, pat: 5, clean: 3, room: 1 } },
    teen: { next: 'adult', need: { feed: 10, pat: 10, clean: 7, room: 2 } },
};

interface PetRow {
    id: string; student_id: string; species: string; name: string | null; status: string;
    stage: Stage; stage_day: string; fed_days: number; last_fed_day: string | null; created_at: number;
}

/** 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
const prevDay = (d: string) => new Date(Date.parse(d) - 86400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

const NameBody = z.object({ name: z.string().trim().min(1).max(8) });
const GrowBody = z.object({ name: z.string().trim().min(1).max(8).optional() }).optional();
const CleanBody = z.object({ id: z.string().max(40).optional() }).optional();

export function registerPetRoutes(app: FastifyInstance, db: Db, auth: AuthHandler) {
    // 지금 키우는 펫. 처음이면 알을 무료로 하나 준다 (지금은 곰만 그림이 있다)
    const activePet = (studentId: string): PetRow => {
        const row = db.prepare('SELECT * FROM pets WHERE student_id = ? AND status = \'active\'').get(studentId) as PetRow | undefined;
        if (row) return row;
        const now = Date.now();
        const id = ulid();
        db.prepare('INSERT INTO pets (id, student_id, species, stage, stage_day, created_at, updated_at) VALUES (?, ?, ?, \'egg\', ?, ?, ?)')
            .run(id, studentId, 'bear', kstDay(now), now, now);
        return db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as PetRow;
    };

    const roomLevel = (studentId: string) =>
        (db.prepare('SELECT room_level FROM pet_home WHERE student_id = ?').get(studentId) as { room_level: number } | undefined)?.room_level ?? 0;

    const balance = (studentId: string) => {
        const b = db.prepare('SELECT diamond, topaz FROM gems_balance WHERE student_id = ?').get(studentId) as { diamond: number; topaz: number } | undefined;
        return { diamonds: b?.diamond ?? 0, topaz: b?.topaz ?? 0 };
    };

    const spendTopaz = (studentId: string, amount: number, reason: string, ref: string): boolean => {
        if (balance(studentId).topaz < amount) return false;
        const now = Date.now();
        db.prepare('UPDATE gems_balance SET topaz = topaz - ?, updated_at = ? WHERE student_id = ?').run(amount, now, studentId);
        db.prepare(`
            INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
            VALUES (?, ?, 'topaz', ?, ?, ?, ?)
        `).run(ulid(), studentId, -amount, reason, ref, now);
        return true;
    };

    const markDay = (p: PetRow, field: 'fed' | 'patted' | 'cleaned', day: string) => {
        db.prepare(`
            INSERT INTO pet_days (pet_id, student_id, day, ${field}) VALUES (?, ?, ?, 1)
            ON CONFLICT (pet_id, day) DO UPDATE SET ${field} = 1
        `).run(p.id, p.student_id, day);
    };

    // 지금 단계에서 오늘(아직 안 했으면 어제)부터 거꾸로 이어진 날 수
    const streak = (p: PetRow, field: 'fed' | 'patted' | 'cleaned', today: string) => {
        const done = new Set((db.prepare(`SELECT day FROM pet_days WHERE pet_id = ? AND day >= ? AND ${field} = 1`)
            .all(p.id, p.stage_day) as { day: string }[]).map(r => r.day));
        let d = done.has(today) ? today : prevDay(today);
        let n = 0;
        while (done.has(d)) { n++; d = prevDay(d); }
        return n;
    };

    const growth = (p: PetRow, today: string, room: number) => {
        if (p.stage === 'adult') return { next: null, ready: false, conds: [] };
        const g = GROWTH[p.stage];
        const have: Record<Cond, number> = {
            feed: streak(p, 'fed', today), pat: streak(p, 'patted', today), clean: streak(p, 'cleaned', today), room,
        };
        const conds = (Object.keys(g.need) as Cond[]).map(key => ({ key, have: Math.min(have[key], g.need[key]!), need: g.need[key]! }));
        return { next: g.next, ready: conds.every(c => c.have >= c.need), conds };
    };

    const view = (p: PetRow) => {
        const now = Date.now();
        const today = kstDay(now);
        const room = roomLevel(p.student_id);
        const day = db.prepare('SELECT fed, patted FROM pet_days WHERE pet_id = ? AND day = ?').get(p.id, today) as { fed: number; patted: number } | undefined;
        const poops = db.prepare('SELECT id, at, u, v FROM pet_poops WHERE pet_id = ? AND cleaned_at IS NULL ORDER BY at').all(p.id) as { id: string; at: number; u: number; v: number }[];
        // 알은 먹지 않는다. 깨어난 뒤 한 번도 안 먹었으면 깨어난 날을 마지막 밥 날로 친다
        const since = daysBetween(p.last_fed_day ?? p.stage_day, today);
        return {
            pet: {
                id: p.id,
                species: p.species,
                name: p.name,
                stage: p.stage,
                fed_today: !!day?.fed,
                patted_today: !!day?.patted,
                fullness: p.stage === 'egg' ? FULL : Math.max(0, FULL - since),
                poops: poops.filter(x => x.at <= now).map(({ id, u, v }) => ({ id, u, v })),
                next_poop_at: poops.find(x => x.at > now)?.at ?? null,
                growth: growth(p, today, room),
            },
            room: { level: room, max: MAX_ROOM, next_price: ROOM_PRICES[room] ?? null },
        };
    };

    const withGems = (studentId: string) => ({ ...view(activePet(studentId)), ...balance(studentId) });
    const notStudent = (role: string) => role !== 'student';

    // GET /pet
    app.get('/pet', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        return withGems(req.user.id);
    });

    // POST /pet/feed  (하루 1번, 토파즈 3개)
    app.post('/pet/feed', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const result = db.transaction((): string => {
            const p = activePet(req.user.id);
            const now = Date.now();
            const today = kstDay(now);
            if (p.stage === 'egg') return 'egg';
            const day = db.prepare('SELECT fed FROM pet_days WHERE pet_id = ? AND day = ?').get(p.id, today) as { fed: number } | undefined;
            if (day?.fed) return 'already_fed';
            if (!spendTopaz(req.user.id, FEED_PRICE, 'pet_feed', p.id)) return 'insufficient_gems';
            db.prepare('UPDATE pets SET fed_days = fed_days + 1, last_fed_day = ?, last_fed_at = ?, updated_at = ? WHERE id = ?')
                .run(today, now, now, p.id);
            markDay(p, 'fed', today);
            for (const h of POOP_AFTER_H) {
                db.prepare('INSERT INTO pet_poops (id, pet_id, student_id, at, u, v) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(ulid(), p.id, p.student_id, now + h * 3600_000, Math.random(), Math.random());
            }
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return withGems(req.user.id);
    });

    // POST /pet/pat  (하루 1번, 무료. 알이면 품어주기)
    app.post('/pet/pat', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const result = db.transaction((): string => {
            const p = activePet(req.user.id);
            const today = kstDay();
            const day = db.prepare('SELECT patted FROM pet_days WHERE pet_id = ? AND day = ?').get(p.id, today) as { patted: number } | undefined;
            if (day?.patted) return 'already_patted';
            markDay(p, 'patted', today);
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return withGems(req.user.id);
    });

    // POST /pet/clean {id?}  (무료. id 가 없으면 보이는 똥을 모두 치운다)
    app.post('/pet/clean', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const body = CleanBody.safeParse(req.body ?? undefined);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
        const id = body.data?.id;
        const n = db.transaction(() => {
            const p = activePet(req.user.id);
            const now = Date.now();
            const r = id
                ? db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE id = ? AND pet_id = ? AND at <= ? AND cleaned_at IS NULL').run(now, id, p.id, now)
                : db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND at <= ? AND cleaned_at IS NULL').run(now, p.id, now);
            if (r.changes > 0) markDay(p, 'cleaned', kstDay(now));
            return r.changes;
        })();
        if (n === 0) return reply.code(409).send({ error: 'nothing_to_clean' });
        return withGems(req.user.id);
    });

    // POST /pet/room  (방 한 단계 넓히기, 토파즈)
    app.post('/pet/room', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const result = db.transaction((): string => {
            const level = roomLevel(req.user.id);
            const price = ROOM_PRICES[level];
            if (price === undefined) return 'max_room';
            if (!spendTopaz(req.user.id, price, 'pet_room', String(level + 1))) return 'insufficient_gems';
            db.prepare(`
                INSERT INTO pet_home (student_id, room_level, updated_at) VALUES (?, ?, ?)
                ON CONFLICT (student_id) DO UPDATE SET room_level = excluded.room_level, updated_at = excluded.updated_at
            `).run(req.user.id, level + 1, Date.now());
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return withGems(req.user.id);
    });

    // POST /pet/grow {name?}  (조건을 다 채웠을 때. 알에서 깰 때는 이름이 필요하다)
    app.post('/pet/grow', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const body = GrowBody.safeParse(req.body ?? undefined);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
        const result = db.transaction((): string => {
            const p = activePet(req.user.id);
            const today = kstDay();
            const g = growth(p, today, roomLevel(req.user.id));
            if (!g.next || !g.ready) return 'not_ready';
            const now = Date.now();
            if (p.stage === 'egg') {
                const name = body.data?.name;
                if (!name) return 'name_required';
                // 깨어난 날부터 배부름을 센다
                db.prepare('UPDATE pets SET stage = ?, stage_day = ?, name = ?, last_fed_day = NULL, updated_at = ? WHERE id = ?')
                    .run(g.next, today, name, now, p.id);
            } else {
                db.prepare('UPDATE pets SET stage = ?, stage_day = ?, updated_at = ? WHERE id = ?')
                    .run(g.next, today, now, p.id);
            }
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return withGems(req.user.id);
    });

    // POST /pet/name {name}  (이름 바꾸기)
    app.post('/pet/name', { preHandler: auth }, async (req, reply) => {
        if (notStudent(req.user.role)) return reply.code(403).send({ error: 'forbidden' });
        const body = NameBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
        const p = activePet(req.user.id);
        if (p.stage === 'egg') return reply.code(409).send({ error: 'egg' });
        db.prepare('UPDATE pets SET name = ?, updated_at = ? WHERE id = ?').run(body.data.name, Date.now(), p.id);
        return withGems(req.user.id);
    });
}
