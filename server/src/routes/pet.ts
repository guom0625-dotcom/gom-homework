import { ulid } from 'ulid';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';

// 펫 앱(gomTamagotchi) — 밥은 하루 1번 토파즈 3개
export const FEED_PRICE = 3;
const FULL = 3;   // 배부름 칸 수. 밥을 주면 가득, 하루마다 1칸씩 준다

interface PetRow {
    id: string; species: string; name: string | null; status: string;
    fed_days: number; last_fed_day: string | null; created_at: number;
}

/** 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

function view(p: PetRow, today = kstDay()) {
    // 밥을 한 번도 안 먹었으면 받은 날을 마지막 밥 날로 친다 (갓 받은 펫이 바로 배고프지 않게)
    const since = daysBetween(p.last_fed_day ?? kstDay(p.created_at), today);
    return {
        id: p.id,
        species: p.species,
        name: p.name,
        fed_days: p.fed_days,
        fed_today: p.last_fed_day === today,
        fullness: Math.max(0, FULL - since),
    };
}

export function registerPetRoutes(app: FastifyInstance, db: Db, auth: AuthHandler) {
    // 지금 키우는 펫. 처음이면 무료로 하나 준다 (지금은 곰만 그림이 있다)
    const activePet = (studentId: string): PetRow => {
        const row = db.prepare('SELECT * FROM pets WHERE student_id = ? AND status = \'active\'').get(studentId) as PetRow | undefined;
        if (row) return row;
        const now = Date.now();
        const id = ulid();
        db.prepare('INSERT INTO pets (id, student_id, species, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run(id, studentId, 'bear', now, now);
        return db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as PetRow;
    };

    const balance = (studentId: string) => {
        const b = db.prepare('SELECT diamond, topaz FROM gems_balance WHERE student_id = ?').get(studentId) as { diamond: number; topaz: number } | undefined;
        return { diamonds: b?.diamond ?? 0, topaz: b?.topaz ?? 0 };
    };

    // GET /pet  (student only)
    app.get('/pet', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        return { pet: view(activePet(req.user.id)) };
    });

    // POST /pet/feed  (student only — 하루 1번, 토파즈 3개)
    app.post('/pet/feed', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const today = kstDay();
        const result = db.transaction((): 'ok' | 'already_fed' | 'insufficient_gems' => {
            const pet = activePet(req.user.id);
            if (pet.last_fed_day === today) return 'already_fed';
            const b = balance(req.user.id);
            if (b.topaz < FEED_PRICE) return 'insufficient_gems';
            const now = Date.now();
            db.prepare('UPDATE gems_balance SET topaz = topaz - ?, updated_at = ? WHERE student_id = ?')
                .run(FEED_PRICE, now, req.user.id);
            db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, 'topaz', ?, 'pet_feed', ?, ?)
            `).run(ulid(), req.user.id, -FEED_PRICE, pet.id, now);
            db.prepare('UPDATE pets SET fed_days = fed_days + 1, last_fed_day = ?, updated_at = ? WHERE id = ?')
                .run(today, now, pet.id);
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return { pet: view(activePet(req.user.id), today), ...balance(req.user.id) };
    });
}
