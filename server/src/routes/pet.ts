import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { sendPetPush, type PushMessage } from '../lib/push.ts';

// 펫 앱(gomTamagotchi)
// - 밥: 하루 1번 토파즈 3개. 먹고 3시간·8시간 뒤에 똥이 하나씩 나온다
// - 쓰다듬기(알이면 품어주기): 하루 1번, 무료
// - 청소: 무료. 그날 똥을 하나라도 치우면 '청소한 날'
// - 성장: 단계마다 조건(누적 일수·방 크기)을 모두 채우면 아이가 성장 버튼을 누른다.
//   방은 다른 조건을 다 채워야 넓힐 수 있다 (돌봄 → 방 넓히기 → 성장)
//   누적 일수는 빠진 날 이틀마다 하루씩 깎인다 (2026-10-20 사용자 결정)
// - 아픔: 배부름 0으로 2일(마지막 밥 날 +5일) 또는 똥을 24시간 넘게 두면 아프다.
//   약(🔶10)으로 낫는다. 굶어서 아프면 밥도 먹어야 낫는다. 똥이 남아 있으면 다시 아프다.
//   아픈 지 하루가 지나면 중병 — 약이 듣지 않고 병원에 3일(하루 1번, 🔶10) 다녀야 낫는다.
// - 떠남: 7일 굶거나, 아픈 상태가 3일 이어지면 떠난다(병원에 간 날은 세지 않는다). 새 알은 🔶20
export const FEED_PRICE = 3;
const FULL = 3;                          // 배부름 칸 수. 밥을 주면 가득, 하루마다 1칸씩 준다
const POOP_AFTER_H = [3, 8];
const ROOM_PRICES = [30, 60];            // 작은 방 → 중간 방 → 큰 방
const MAX_ROOM = ROOM_PRICES.length;
const H = 3600_000;
const DAY = 24 * H;

// 값은 앱이 GET /pet 의 shop 으로 받아 쓴다 (가격은 서버에만 둔다)
const PRICES = { medicine: 10, hospital: 10, helper: 15, new_egg: 20 };
const HOSPITAL_DAYS = 3;
const SNACKS: Record<string, { price: number; hours: number }> = {
    cookie: { price: 2, hours: 3 },
    apple: { price: 3, hours: 6 },
    icecream: { price: 4, hours: 24 },
};
const SNACKS_PER_DAY = 2;
const TOYS: Record<string, number> = { doll: 15, bubbles: 20, tunnel: 25, slide: 40 };
const DECOR: Record<string, number> = {
    rug: 10, plant: 10, curtain: 15,
    wall_sky: 20, wall_pink: 20, wall_mint: 20,   // 벽지: 하나만 붙인다
    cushion_blue: 10,                              // 쿠션 색
};
const HELPER_EVERY_DAYS = 7;
// 미니게임 똥피하기 (2026-10-23 사용자 결정): 하루 5판, 점수는 버틴 시간, 순위는 서버 전체.
// 보상은 기분좋음만 (보석 없음). 지금 펫이나 도감의 펫으로만 할 수 있다
const GAME_PER_DAY = 5;
const GAME_HAPPY_H = 3;
const GAME_MAX_MS = 30 * 60_000;        // 이보다 오래된 판은 끝낼 수 없다
const GAME_SLACK_MS = 2000;             // 점수가 실제 지난 시간보다 이만큼 넘으면 받지 않는다
// 능력이 있는 물건 — 방에 꺼내 놓았을 때만 작동한다 (2026-10-20 사용자 결정)
//  robot 자동 청소기: 똥이 나오고 12시간이 지나면 하루 1번 치운다 ('청소한 날'로는 세지 않는다)
//  feeder 자동 급식기: 밥을 안 준 날 밤 9시에 밥을 준다 (🔶3 나감, '밥 준 날'로는 세지 않는다)
//  firstaid 구급상자: 중병이 되기까지 1일 → 2일
//  bed 포근한 침대: 아파서 떠나기까지 3일 → 4일
const GADGETS: Record<string, number> = { robot: 800, feeder: 1000, firstaid: 500, bed: 600 };   // 2026-10-20 10배로 올림
/** 방 크기별로 꺼내 놓을 수 있는 물건 수 (벽지·쿠션 색은 세지 않는다) */
const SLOTS = [2, 4, 6];
const PLACEABLE = new Set([...Object.keys(TOYS), ...Object.keys(GADGETS), 'rug', 'plant', 'curtain']);
const itemPrice = (key: string): number | undefined => TOYS[key] ?? DECOR[key] ?? GADGETS[key];
// 옷 (2026-10-20 사용자 결정): 상의·모자를 모양×색으로 판다. 그 시기 크기로만 사고 입는다 —
// 자라면 벗겨지고 새로 사야 한다. 클수록 비싸다. pet_items 에 'top_tee_red@baby' 처럼 둔다
const TOPS: Record<string, number> = { tee: 10, stripe: 12, hoodie: 15, overalls: 15 };
const HATS: Record<string, number> = { ribbon: 6, beanie: 8, cap: 10, straw: 12, crown: 20 };
const COLORS = ['red', 'blue', 'yellow', 'green', 'pink'];
const SIZE_MULT: Record<string, number> = { baby: 1, teen: 1.5, adult: 2 };
const clothesPrices = (stage: string) => {
    const m = SIZE_MULT[stage] ?? 1;
    const scale = (t: Record<string, number>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * m)]));
    return { tops: scale(TOPS), hats: scale(HATS) };
};
/** 'top_tee_red' → {slot, price}. 모르는 옷이면 undefined */
const clothInfo = (item: string, stage: string) => {
    const m = /^(top|hat)_([a-z]+)_([a-z]+)$/.exec(item);
    if (!m || !COLORS.includes(m[3]) || !(stage in SIZE_MULT)) return undefined;
    const price = clothesPrices(stage)[m[1] === 'top' ? 'tops' : 'hats'][m[2]];
    return price === undefined ? undefined : { slot: m[1] as 'top' | 'hat', price };
};

type Stage = 'egg' | 'baby' | 'teen' | 'adult';
// 펫 종류 6가지: bear 곰, dog 강아지, cat 고양이, rabbit 토끼, squirrel 다람쥐, hamster 햄스터.
// 앱에 그림이 있는 종류만 알에서 나온다. 값은 털색·무늬 가짓수 (앱 src/pet/species.ts 의 looks 개수와 맞출 것)
const VARIANTS: Record<string, number> = { bear: 4, dog: 5, cat: 5, rabbit: 4, squirrel: 2, hamster: 4 };
const HATCHABLE = Object.keys(VARIANTS);
type Cond = 'feed' | 'pat' | 'clean' | 'room';
// 다음 단계로 가는 조건. feed·pat·clean 은 지금 단계의 누적 일수, room 은 방 크기
const GROWTH: Record<Exclude<Stage, 'adult'>, { next: Stage; need: Partial<Record<Cond, number>> }> = {
    // 알 2일 + 유아 7일 + 청소년 15일 → 성인이 되면 졸업해서 도감에 남긴다 (2026-10-21 사용자 결정)
    egg: { next: 'baby', need: { pat: 2 } },
    baby: { next: 'teen', need: { feed: 7, pat: 7, clean: 7, room: 1 } },
    teen: { next: 'adult', need: { feed: 15, pat: 15, clean: 15, room: 2 } },
};

interface PetRow {
    id: string; student_id: string; species: string; name: string | null; status: string;
    stage: Stage; stage_day: string; fed_days: number; last_fed_day: string | null; created_at: number;
    sick_since: number | null; med_given: number; hospital_visits: number; happy_until: number | null;
    helper_day: string | null; gone_at: number | null; gone_reason: string | null; robot_day: string | null;
    wear_top: string | null; wear_hat: string | null; variant: number;
}
interface DayRow { fed: number; patted: number; cleaned: number; snacks: number; hospital: number; auto_fed: number }

/** 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * H).toISOString().slice(0, 10);
const prevDay = (d: string) => new Date(Date.parse(d) - DAY).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
/** 한국 날짜의 0시 (ms) */
const dayStart = (d: string) => Date.parse(`${d}T00:00:00+09:00`);

const NameBody = z.object({ name: z.string().trim().min(1).max(8) });
const GrowBody = z.object({ name: z.string().trim().min(1).max(8).optional() }).optional();
const CleanBody = z.object({ id: z.string().max(40).optional() }).optional();
const ItemBody = z.object({ item: z.string().max(30) });
const PlaceBody = z.object({ item: z.string().max(30), placed: z.boolean() });
const TestBody = z.object({ action: z.string().max(30) });
const GameStartBody = z.object({ pet_id: z.string().max(40) });
const GameEndBody = z.object({ id: z.string().max(40), score_ms: z.number().int().min(0).max(3_600_000) });
// 방 꾸미기: 옮길 수 있는 물건 (쿠션·밥그릇은 창고에 넣을 수 없지만 옮길 수는 있다). 커튼은 창문에 붙어 있어 빠진다
const MOVABLE = new Set(['cushion', 'bowl', ...Object.keys(TOYS), ...Object.keys(GADGETS), 'rug', 'plant']);
const LayoutBody = z.object({
    layout: z.record(z.string().max(20), z.object({
        x: z.number().min(0).max(40), z: z.number().min(0).max(40), rot: z.number().int().min(0).max(3),
    })),
});
const PushBody = z.object({ token: z.string().min(1).max(4096) });
const WearBody = z.object({ slot: z.enum(['top', 'hat']), item: z.string().max(30).nullable() });
const DecorBody = z.object({ wallpaper: z.string().max(30).nullable().optional(), cushion: z.string().max(30).nullable().optional() });

type Result = 'ok' | string;

export function registerPetRoutes(app: FastifyInstance, db: Db, auth: AuthHandler) {
    // 시험 기능(시간 건너뛰기 등)을 쓸 수 있고 성장 조건 숫자를 볼 수 있는 학생 (server/.env)
    const TESTERS = new Set((process.env.PET_TEST_STUDENTS ?? '').split(',').map(x => x.trim()).filter(Boolean));
    const getPet = (id: string) => db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as PetRow;

    const newEgg = (studentId: string) => {
        const now = Date.now();
        const id = ulid();
        db.prepare('INSERT INTO pets (id, student_id, species, stage, stage_day, created_at, updated_at) VALUES (?, ?, \'\', \'egg\', ?, ?, ?)')
            .run(id, studentId, kstDay(now), now, now);
        return getPet(id);
    };

    // 지금 보여 줄 펫: 키우는 펫, 또는 떠나고 편지만 남은 펫. 처음이면 알을 무료로 하나 준다
    const currentPet = (studentId: string): PetRow => {
        const row = db.prepare(`
            SELECT * FROM pets WHERE student_id = ? AND status IN ('active', 'gone') ORDER BY created_at DESC LIMIT 1
        `).get(studentId) as PetRow | undefined;
        return row ? evaluate(row) : newEgg(studentId);
    };

    const roomLevel = (studentId: string) =>
        (db.prepare('SELECT room_level FROM pet_home WHERE student_id = ?').get(studentId) as { room_level: number } | undefined)?.room_level ?? 0;
    const home = (studentId: string) =>
        (db.prepare('SELECT room_level, wallpaper, cushion, layout FROM pet_home WHERE student_id = ?').get(studentId) as
            { room_level: number; wallpaper: string | null; cushion: string | null; layout: string | null } | undefined)
        ?? { room_level: 0, wallpaper: null, cushion: null, layout: null };
    const ensureHome = (studentId: string) => db.prepare(`
        INSERT INTO pet_home (student_id, room_level, updated_at) VALUES (?, 0, ?) ON CONFLICT (student_id) DO NOTHING
    `).run(studentId, Date.now());
    const owned = (studentId: string) =>
        (db.prepare('SELECT item_key FROM pet_items WHERE student_id = ? ORDER BY created_at').all(studentId) as { item_key: string }[]).map(r => r.item_key);
    const itemList = (studentId: string) =>
        (db.prepare('SELECT item_key AS key, placed FROM pet_items WHERE student_id = ? ORDER BY created_at').all(studentId) as { key: string; placed: number }[])
            .map(r => ({ key: r.key, placed: r.placed === 1 }));
    const isPlaced = (studentId: string, key: string) =>
        !!db.prepare('SELECT 1 FROM pet_items WHERE student_id = ? AND item_key = ? AND placed = 1').get(studentId, key);
    /** 방에 꺼내 둔 시각 (없으면 null) */
    const placedAt = (studentId: string, key: string) =>
        (db.prepare('SELECT placed_at FROM pet_items WHERE student_id = ? AND item_key = ? AND placed = 1').get(studentId, key) as { placed_at: number | null } | undefined)?.placed_at ?? null;
    const placedCount = (studentId: string) =>
        (db.prepare('SELECT COUNT(*) AS n FROM pet_items WHERE student_id = ? AND placed = 1').get(studentId) as { n: number }).n;

    /** 도감: 졸업한 펫 (졸업한 순서) */
    const dex = (studentId: string) =>
        db.prepare(`SELECT id, species, variant, name, graduated_at AS at FROM pets
            WHERE student_id = ? AND status = 'graduated' ORDER BY graduated_at`).all(studentId) as { id: string; species: string; variant: number; name: string | null; at: number }[];
    /** 알에서 나올 종류·무늬: 도감에 있는 것은 빼고 무작위 (다 모았으면 아무거나) */
    const pickLook = (studentId: string) => {
        const have = new Set(dex(studentId).map(d => `${d.species}:${d.variant}`));
        const all = HATCHABLE.flatMap(sp => Array.from({ length: VARIANTS[sp] }, (_, v) => [sp, v] as const));
        const left = all.filter(([sp, v]) => !have.has(`${sp}:${v}`));
        const pool = left.length ? left : all;
        return pool[Math.floor(Math.random() * pool.length)];
    };
    const DEX_TOTAL = Object.values(VARIANTS).reduce((a, b) => a + b, 0);

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

    const dayRow = (p: PetRow, day: string) =>
        db.prepare('SELECT fed, patted, cleaned, snacks, hospital, auto_fed FROM pet_days WHERE pet_id = ? AND day = ?').get(p.id, day) as DayRow | undefined;

    const markDay = (p: PetRow, field: 'fed' | 'patted' | 'cleaned' | 'hospital', day: string) => {
        db.prepare(`
            INSERT INTO pet_days (pet_id, student_id, day, ${field}) VALUES (?, ?, ?, 1)
            ON CONFLICT (pet_id, day) DO UPDATE SET ${field} = 1
        `).run(p.id, p.student_id, day);
    };

    // ── 아픔·떠남 (읽을 때마다 지금 시각으로 다시 따진다) ──────────────
    const fedBase = (p: PetRow) => p.last_fed_day ?? p.stage_day;
    /** 굶어서 아파지는 시각 (배부름 0으로 2일 = 마지막 밥 날 +5일 0시) */
    const hungerSickAt = (p: PetRow) => dayStart(addDays(fedBase(p), 5));
    /** 치우지 않은 똥 중 가장 먼저 24시간이 되는 시각 */
    const poopSickAt = (p: PetRow) => {
        const r = db.prepare('SELECT MIN(at) AS at FROM pet_poops WHERE pet_id = ? AND cleaned_at IS NULL').get(p.id) as { at: number | null };
        return r.at === null ? Infinity : r.at + DAY;
    };
    const causes = (p: PetRow, now: number) => ({ hunger: hungerSickAt(p) <= now, poop: poopSickAt(p) <= now });
    const severeAt = (p: PetRow) => (p.sick_since ?? Infinity) + (isPlaced(p.student_id, 'firstaid') ? 2 : 1) * DAY;
    const hospitalDays = (p: PetRow) => p.sick_since === null ? 0 :
        (db.prepare('SELECT COUNT(*) AS n FROM pet_days WHERE pet_id = ? AND day >= ? AND hospital = 1').get(p.id, kstDay(p.sick_since)) as { n: number }).n;
    /** 아파서 떠나는 시각: 아픈 지 3일. 병원에 간 날은 하루씩 미룬다 */
    const sickLeaveAt = (p: PetRow) => (p.sick_since ?? Infinity) + ((isPlaced(p.student_id, 'bed') ? 4 : 3) + hospitalDays(p)) * DAY;

    const addPoops = (p: PetRow, fedAt: number) => {
        for (const h of POOP_AFTER_H) {
            db.prepare('INSERT INTO pet_poops (id, pet_id, student_id, at, u, v) VALUES (?, ?, ?, ?, ?, ?)')
                .run(ulid(), p.id, p.student_id, fedAt + h * H, Math.random(), Math.random());
        }
    };

    // 자동 급식기: 밥을 안 준 날 밤 9시에 (밀린 날도 차례로)
    const runFeeder = (p: PetRow, now: number) => {
        const since = placedAt(p.student_id, 'feeder');
        if (since === null) return;
        let d = p.last_fed_day ? addDays(p.last_fed_day, 1) : p.stage_day;
        for (let i = 0; i < 8; i++, d = addDays(d, 1)) {
            const at = dayStart(d) + 21 * H;
            if (at > now) break;
            if (at < since) continue;          // 꺼내 놓기 전 날은 못 챙긴다
            if (!spendTopaz(p.student_id, FEED_PRICE, 'pet_feeder', p.id)) break;
            db.prepare('UPDATE pets SET last_fed_day = ?, last_fed_at = ? WHERE id = ?').run(d, at, p.id);
            db.prepare(`INSERT INTO pet_days (pet_id, student_id, day, auto_fed) VALUES (?, ?, ?, 1)
                        ON CONFLICT (pet_id, day) DO UPDATE SET auto_fed = 1`).run(p.id, p.student_id, d);
            addPoops(p, at);
        }
    };

    /** 급식기가 다음에 밥을 줄 시각: 오늘 밥을 안 먹었으면 오늘 밤 9시 (앱이 그때 다시 읽게) */
    const feederNextAt = (p: PetRow, now: number): number | null => {
        const since = placedAt(p.student_id, 'feeder');
        if (since === null || p.stage === 'egg' || p.status !== 'active') return null;
        const today = kstDay(now);
        if (p.last_fed_day && p.last_fed_day >= today) return null;
        const at = dayStart(today) + 21 * H;
        return at >= since ? at : null;
    };

    // 자동 청소기: 똥이 나오고 12시간 지나면 하루 1번 그때까지 나온 똥을 치운다
    /** 청소기가 다음에 치우러 가는 시각 (치울 똥이 없거나 청소기가 없으면 null) */
    const robotNextAt = (p: PetRow, last: string | null): number | null => {
        const since = placedAt(p.student_id, 'robot');
        if (since === null) return null;
        const r = db.prepare('SELECT MIN(at) AS at FROM pet_poops WHERE pet_id = ? AND cleaned_at IS NULL').get(p.id) as { at: number | null };
        if (r.at === null) return null;
        let at = Math.max(r.at + 12 * H, since);
        if (last && kstDay(at) <= last) at = Math.max(at, dayStart(addDays(last, 1)));   // 하루 1번
        return at;
    };
    const runRobot = (p: PetRow, now: number) => {
        let last = p.robot_day;
        for (let i = 0; i < 8; i++) {
            const at = robotNextAt(p, last);
            if (at === null || at > now) break;
            db.prepare("UPDATE pet_poops SET cleaned_at = ?, cleaned_by = 'robot' WHERE pet_id = ? AND cleaned_at IS NULL AND at <= ?").run(at, p.id, at);
            last = kstDay(at);
            db.prepare('UPDATE pets SET robot_day = ? WHERE id = ?').run(last, p.id);
        }
    };

    const evaluate = (p: PetRow): PetRow => {
        if (p.status !== 'active' || p.stage === 'egg') return p;
        const now = Date.now();
        const set = (sql: string, ...args: unknown[]) => { db.prepare(`UPDATE pets SET ${sql}, updated_at = ? WHERE id = ?`).run(...args, now, p.id); p = getPet(p.id); };

        // 능력 물건이 먼저 일한다
        runFeeder(p, now);
        runRobot(p, now);
        p = getPet(p.id);

        // 7일 굶으면 떠난다
        const starveAt = dayStart(addDays(fedBase(p), 7));
        if (starveAt <= now) { set("status = 'gone', gone_at = ?, gone_reason = 'hunger'", starveAt); return p; }

        if (p.sick_since === null) {
            const at = Math.min(hungerSickAt(p), poopSickAt(p));
            if (at <= now) set('sick_since = ?, med_given = 0, hospital_visits = 0', at);
        }
        if (p.sick_since !== null) {
            const c = causes(p, now);
            const severe = severeAt(p) <= now;
            // 치료(약 또는 병원)를 받았고 원인도 없어졌으면 낫는다
            const treated = severe ? p.hospital_visits >= HOSPITAL_DAYS : (p.med_given === 1 || p.hospital_visits >= HOSPITAL_DAYS);
            if (treated && !c.hunger && !c.poop) {
                set('sick_since = NULL, med_given = 0, hospital_visits = 0');
            } else {
                const leaveAt = sickLeaveAt(p);
                if (leaveAt <= now) set("status = 'gone', gone_at = ?, gone_reason = 'sick'", leaveAt);
            }
        }
        return p;
    };

    // ── 체형 (2026-10-21 사용자 결정) ─────────────────
    // 최근 7일(오늘 포함): 밥 먹은 날 +1, 간식 하나 +0.5, 거른 날 -1 (오늘은 아직 안 먹었어도 0).
    // 처음 밥을 먹기 전 날은 +1 로 친다. 펫마다 기록이 남으니 자라도 체형이 이어진다
    const buildScore = (p: PetRow, today: string) => {
        const rows = db.prepare('SELECT day, fed, auto_fed, snacks FROM pet_days WHERE pet_id = ? AND day > ? AND day <= ?')
            .all(p.id, addDays(today, -7), today) as { day: string; fed: number; auto_fed: number; snacks: number }[];
        const byDay = new Map(rows.map(r => [r.day, r]));
        const first = (db.prepare('SELECT MIN(day) AS d FROM pet_days WHERE pet_id = ? AND (fed = 1 OR auto_fed = 1)').get(p.id) as { d: string | null }).d;
        let score = 0;
        for (let i = 6; i >= 0; i--) {
            const d = addDays(today, -i), r = byDay.get(d);
            const ate = !!(r?.fed || r?.auto_fed);
            score += (r?.snacks ?? 0) * 0.5;
            if (ate) score += 1;
            else if (d === today) score += 0;
            else if (!first || d < first) score += 1;
            else score -= 1;
        }
        return score;
    };
    const buildOf = (score: number) => score <= 4 ? 'thin' : score <= 8 ? 'normal' : score <= 11 ? 'chubby' : 'fat';

    // ── 성장 ───────────────────────────────────
    /** 그날 치울 똥이 없었나: 0시~밤 9시 사이에 방에 똥이 하나도 없었다 (밤 9시 넘어 나온 똥은 다음 날 치우면 된다).
     *  자동 청소기가 치운 똥도 있던 똥으로 친다 (청소기는 청소한 날로 안 셈) */
    const noPoopDay = (p: PetRow, d: string) => !db.prepare(
        'SELECT 1 FROM pet_poops WHERE pet_id = ? AND at < ? AND (cleaned_at IS NULL OR cleaned_at > ?) LIMIT 1',
    ).get(p.id, dayStart(d) + 21 * H, dayStart(d));
    // 지금 단계에서 한 날 수 - 빠진 날 / 2 (내림). 오늘은 아직 안 했어도 빠진 날로 치지 않는다
    // 날짜 순서대로: 한 날 +1, 빠진 날 이틀마다 -1. 0일 때 빠진 날은 벌점 없음 — 마이너스가 쌓이지 않는다 (2026-10-21 사용자 결정).
    // 오늘은 아직 안 했어도 빠진 날로 치지 않는다. 치울 똥이 없던 지난날은 청소한 날도 빠진 날도 아니다
    // 단계가 시작된 날(받은 날·깨어난 날)은 세지 않고 다음 날부터 센다 — 저녁에 받은 알이 다음 날 아침에 깨지 않게 (2026-10-22 사용자 결정)
    const countFrom = (p: PetRow) => addDays(p.stage_day, 1);
    const progress = (p: PetRow, field: 'fed' | 'patted' | 'cleaned', today: string) => {
        const from = countFrom(p);
        if (from > today) return { have: 0, missed: 0 };
        const doneDays = new Set((db.prepare(`SELECT day FROM pet_days WHERE pet_id = ? AND day >= ? AND day <= ? AND ${field} = 1`)
            .all(p.id, from, today) as { day: string }[]).map(r => r.day));
        let have = 0, missed = 0, half = false;
        for (let d = from; d < today; d = addDays(d, 1)) {
            if (doneDays.has(d)) { have++; continue; }
            if (field === 'cleaned' && noPoopDay(p, d)) continue;
            missed++;
            if (have === 0) { half = false; continue; }      // 0이면 벌점 없음
            if (half) { have--; half = false; } else half = true;
        }
        if (doneDays.has(today)) have++;
        return { have, missed };
    };

    const growth = (p: PetRow, today: string, room: number) => {
        if (p.stage === 'adult') return { next: null, ready: false, conds: [] };
        const g = GROWTH[p.stage];
        const prog: Record<Cond, { have: number; missed: number }> = {
            feed: progress(p, 'fed', today), pat: progress(p, 'patted', today), clean: progress(p, 'cleaned', today),
            room: { have: room, missed: 0 },
        };
        const conds = (Object.keys(g.need) as Cond[]).map(key => ({
            key, have: Math.min(prog[key].have, g.need[key]!), need: g.need[key]!, missed: prog[key].missed,
        }));
        return { next: g.next, ready: conds.every(c => c.have >= c.need), conds };
    };

    /** 방을 넓힐 수 있나: 이번 단계에 더 큰 방이 필요하고, 방 말고 다른 조건은 다 채웠을 때 (2026-10-20 사용자 결정) */
    const roomReady = (p: PetRow, today: string, room: number) => {
        if (p.status !== 'active' || p.stage === 'adult') return false;
        const need = GROWTH[p.stage].need.room;
        if (need === undefined || room >= need) return false;
        return growth(p, today, room).conds.every(c => c.key === 'room' || c.have >= c.need);
    };

    /** 아이에게는 무엇이 몇 번 남았는지 보이지 않게: 준비됐는지와 방이 좁은지만 */
    const hideCounts = (g: ReturnType<typeof growth>) => ({
        next: g.next, ready: g.ready, conds: [],
        room_short: g.conds.some(c => c.key === 'room' && c.have < c.need),
    });

    /** 돌봄 도우미로 지울 수 있는 가장 최근의 빠진 날 (단계 시작일 ~ 어제) */
    const lastMissedDay = (p: PetRow, today: string): string | null => {
        const fields = p.stage === 'egg' ? ['patted'] : ['fed', 'patted', 'cleaned'];
        for (let d = prevDay(today); d >= countFrom(p); d = prevDay(d)) {
            const r = dayRow(p, d) as unknown as Record<string, number> | undefined;
            if (!r || fields.some(f => !r[f] && !(f === 'cleaned' && noPoopDay(p, d)))) return d;
        }
        return null;
    };
    const helperReady = (p: PetRow, today: string) => !p.helper_day || daysBetween(p.helper_day, today) >= HELPER_EVERY_DAYS;

    // ── 기분 (앱은 잠자는 시간만 더 얹는다) ─────────────
    const mood = (p: PetRow, now: number, today: string, fullness: number, d: DayRow | undefined) => {
        if (p.sick_since !== null) return 'sick';
        if (fullness === 0) return 'hungry';
        if (daysBetween(fedBase(p), today) >= 2) return 'angry';                 // 밥을 걸렀다
        if ((p.happy_until ?? 0) > now) return 'happy';                          // 간식
        const lastPat = (db.prepare('SELECT MAX(day) AS day FROM pet_days WHERE pet_id = ? AND patted = 1').get(p.id) as { day: string | null }).day;
        if (daysBetween(lastPat ?? p.stage_day, today) >= 3) return 'sad';       // 3일 넘게 안 쓰다듬음
        if (d?.fed && d?.patted) return 'happy';
        return 'normal';
    };

    const view = (p: PetRow) => {
        const now = Date.now();
        const today = kstDay(now);
        const h = home(p.student_id);
        const d = dayRow(p, today);
        const poops = db.prepare('SELECT id, at, u, v FROM pet_poops WHERE pet_id = ? AND cleaned_at IS NULL ORDER BY at').all(p.id) as { id: string; at: number; u: number; v: number }[];
        const egg = p.stage === 'egg';
        const tester = TESTERS.has(p.student_id);
        // 알은 먹지 않는다. 깨어난 뒤 한 번도 안 먹었으면 깨어난 날을 마지막 밥 날로 친다
        const fullness = egg ? FULL : Math.max(0, FULL - daysBetween(fedBase(p), today));
        const sick = p.sick_since !== null;
        const c = sick ? causes(p, now) : { hunger: false, poop: false };
        const severe = sick && severeAt(p) <= now;
        // 다음에 무언가 바뀌는 시각 (앱이 그때 다시 읽는다)
        const nextAt = [poops.find(x => x.at > now)?.at, sick ? undefined : Math.min(hungerSickAt(p), poopSickAt(p)),
            sick && !severe ? severeAt(p) : undefined, sick ? sickLeaveAt(p) : undefined, p.happy_until ?? undefined,
            robotNextAt(p, p.robot_day) ?? undefined, feederNextAt(p, now) ?? undefined]
            .filter((t): t is number => typeof t === 'number' && isFinite(t) && t > now);
        return {
            pet: {
                id: p.id,
                species: p.species || null,   // 알이면 아직 모른다
                variant: p.variant,           // 털색·무늬
                name: p.name,
                stage: p.stage,
                gone: p.status === 'gone' ? { reason: p.gone_reason } : null,
                mood: egg ? 'normal' : mood(p, now, today, fullness, d),
                fed_today: !!d?.fed || !!d?.auto_fed,
                auto_fed_today: !!d?.auto_fed,
                patted_today: !!d?.patted,
                fullness,
                // 체형 thin 홀쭉 / normal 보통 / chubby 통통 / fat 뚱뚱 (알이면 null)
                build: egg ? null : buildOf(buildScore(p, today)),
                ...(tester && !egg ? { build_score: buildScore(p, today) } : {}),
                poops: poops.filter(x => x.at <= now).map(({ id, u, v }) => ({ id, u, v })),
                next_poop_at: poops.find(x => x.at > now)?.at ?? null,
                next_change_at: nextAt.length ? Math.min(...nextAt) : null,
                // 최근 하루 동안 자동 청소기가 치운 똥 (앱이 청소기가 다녀가는 모습을 보여 준다)
                robot_cleaned: (db.prepare(`SELECT id, u, v, cleaned_at AS at FROM pet_poops
                    WHERE pet_id = ? AND cleaned_by = 'robot' AND cleaned_at > ? ORDER BY cleaned_at`).all(p.id, now - DAY) as { id: string; u: number; v: number; at: number }[]),
                health: sick ? {
                    severe,
                    hungry: c.hunger,                 // 밥도 먹어야 낫는다
                    dirty: c.poop,                    // 똥도 치워야 낫는다
                    med_given: p.med_given === 1,
                    hospital_visits: p.hospital_visits,
                    hospital_needed: HOSPITAL_DAYS,
                    visited_today: !!d?.hospital,
                    leave_at: sickLeaveAt(p),
                } : null,
                snacks_today: d?.snacks ?? 0,
                snacks_per_day: SNACKS_PER_DAY,
                helper_ready: helperReady(p, today) && lastMissedDay(p, today) !== null,
                // 입고 있는 옷 ('top_tee_red', 크기 표시는 뺀다)
                wear: { top: p.wear_top?.split('@')[0] ?? null, hat: p.wear_hat?.split('@')[0] ?? null },
                growth: tester ? growth(p, today, h.room_level) : hideCounts(growth(p, today, h.room_level)),
            },
            tester,
            room: {
                level: h.room_level, max: MAX_ROOM, next_price: ROOM_PRICES[h.room_level] ?? null,
                slots: SLOTS[h.room_level], used: placedCount(p.student_id),
                can_upgrade: roomReady(p, today, h.room_level),
            },
            items: itemList(p.student_id),
            // 도감 (졸업한 펫). total = 모을 수 있는 종류·무늬 가짓수
            dex: { pets: dex(p.student_id), total: DEX_TOTAL },
            decor: { wallpaper: h.wallpaper, cushion: h.cushion },
            // 물건 자리와 방향. 없는 물건은 앱의 기본 자리
            layout: h.layout ? JSON.parse(h.layout) as Record<string, { x: number; z: number; rot: number }> : {},
            shop: {
                snacks: SNACKS, toys: TOYS, decor: DECOR, gadgets: GADGETS, ...PRICES, feed: FEED_PRICE,
                // 지금 크기의 옷값 (알이면 유아 크기 값을 보여 주기만 한다)
                clothes: { ...clothesPrices(egg ? 'baby' : p.stage), colors: COLORS },
            },
        };
    };

    const withGems = (studentId: string) => ({ ...view(currentPet(studentId)), ...balance(studentId) });

    /** POST 동작 하나: 학생만, 한 트랜잭션 안에서 처리하고 결과 화면을 돌려준다 */
    const action = <B>(path: string, schema: z.ZodType<B> | null,
        fn: (p: PetRow, body: B, ctx: { now: number; today: string; studentId: string }) => Result,
        opts: { allowGone?: boolean; allowEgg?: boolean } = {}) => {
        app.post(path, { preHandler: auth }, async (req, reply) => {
            if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
            let body = undefined as B;
            if (schema) {
                const parsed = schema.safeParse(req.body ?? undefined);
                if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
                body = parsed.data;
            }
            const result = db.transaction((): Result => {
                const p = currentPet(req.user.id);
                if (p.status === 'gone' && !opts.allowGone) return 'gone';
                if (p.stage === 'egg' && !opts.allowEgg) return 'egg';
                const now = Date.now();
                const r = fn(p, body, { now, today: kstDay(now), studentId: req.user.id });
                if (r === 'ok') evaluate(getPet(p.id));
                return r;
            })();
            if (result !== 'ok') return reply.code(409).send({ error: result });
            return withGems(req.user.id);
        });
    };

    // GET /pet
    app.get('/pet', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        return db.transaction(() => withGems(req.user.id))();
    });

    // GET /pet/student/:id — 엄마(매니저)가 자기 학생의 펫을 구경한다. 없으면 알을 만들지 않고 pet:null
    app.get<{ Params: { id: string } }>('/pet/student/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const studentId = req.params.id;
        const linked = db.prepare('SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?')
            .get(req.user.id, studentId);
        if (!linked) return reply.code(404).send({ error: 'not_found' });
        return db.transaction(() => {
            const row = db.prepare(`
                SELECT * FROM pets WHERE student_id = ? AND status IN ('active', 'gone') ORDER BY created_at DESC LIMIT 1
            `).get(studentId) as PetRow | undefined;
            return row ? view(evaluate(row)) : { pet: null };
        })();
    });

    // 밥 (하루 1번, 🔶3)
    action('/pet/feed', null, (p, _b, { now, today, studentId }) => {
        const dr = dayRow(p, today);
        if (dr?.fed || dr?.auto_fed) return 'already_fed';
        if (!spendTopaz(studentId, FEED_PRICE, 'pet_feed', p.id)) return 'insufficient_gems';
        db.prepare('UPDATE pets SET fed_days = fed_days + 1, last_fed_day = ?, last_fed_at = ?, updated_at = ? WHERE id = ?')
            .run(today, now, now, p.id);
        markDay(p, 'fed', today);
        addPoops(p, now);
        return 'ok';
    });

    // 쓰다듬기 (하루 1번, 무료. 알이면 품어주기)
    action('/pet/pat', null, (p, _b, { today }) => {
        if (dayRow(p, today)?.patted) return 'already_patted';
        markDay(p, 'patted', today);
        return 'ok';
    }, { allowEgg: true });

    // 청소 {id?} (무료. id 가 없으면 보이는 똥을 모두 치운다)
    action('/pet/clean', CleanBody, (p, body, { now, today }) => {
        const r = body?.id
            ? db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE id = ? AND pet_id = ? AND at <= ? AND cleaned_at IS NULL').run(now, body.id, p.id, now)
            : db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND at <= ? AND cleaned_at IS NULL').run(now, p.id, now);
        if (r.changes === 0) return 'nothing_to_clean';
        markDay(p, 'cleaned', today);
        return 'ok';
    });

    // 방 한 단계 넓히기 (토파즈). 방 말고 다른 성장 조건을 다 채웠을 때만 — 넓히면 성장 버튼이 켜진다
    action('/pet/room', null, (p, _b, { studentId, now, today }) => {
        const level = roomLevel(studentId);
        const price = ROOM_PRICES[level];
        if (price === undefined) return 'max_room';
        if (!roomReady(p, today, level)) return 'room_not_ready';
        if (!spendTopaz(studentId, price, 'pet_room', String(level + 1))) return 'insufficient_gems';
        ensureHome(studentId);
        db.prepare('UPDATE pet_home SET room_level = ?, updated_at = ? WHERE student_id = ?').run(level + 1, now, studentId);
        return 'ok';
    });

    // 성장 (조건을 다 채웠을 때). 알이 깨어날 때 종류가 정해진다
    action('/pet/grow', GrowBody, (p, body, { now, today, studentId }) => {
        if (p.sick_since !== null) return 'sick';
        const g = growth(p, today, roomLevel(studentId));
        if (!g.next || !g.ready) return 'not_ready';
        if (p.stage === 'egg') {
            const [species, variant] = pickLook(studentId);
            // 깨어난 날부터 배부름을 센다
            db.prepare('UPDATE pets SET stage = ?, stage_day = ?, species = ?, variant = ?, name = ?, last_fed_day = NULL, helper_day = NULL, updated_at = ? WHERE id = ?')
                .run(g.next, today, species, variant, body?.name ?? null, now, p.id);
        } else {
            // 몸이 커져서 입던 옷은 벗겨진다
            db.prepare('UPDATE pets SET stage = ?, stage_day = ?, helper_day = NULL, wear_top = NULL, wear_hat = NULL, updated_at = ? WHERE id = ?').run(g.next, today, now, p.id);
        }
        return 'ok';
    }, { allowEgg: true });

    // 이름 바꾸기
    action('/pet/name', NameBody, (p, body, { now }) => {
        db.prepare('UPDATE pets SET name = ?, updated_at = ? WHERE id = ?').run(body.name, now, p.id);
        return 'ok';
    });

    // 약 (🔶10). 중병이면 듣지 않는다
    action('/pet/medicine', null, (p, _b, { now, studentId }) => {
        if (p.sick_since === null) return 'not_sick';
        if (severeAt(p) <= now) return 'severe';
        if (p.med_given) return 'already_medicine';
        if (!spendTopaz(studentId, PRICES.medicine, 'pet_medicine', p.id)) return 'insufficient_gems';
        db.prepare('UPDATE pets SET med_given = 1, updated_at = ? WHERE id = ?').run(now, p.id);
        return 'ok';
    });

    // 병원 통원 (하루 1번, 🔶10). 중병일 때만
    action('/pet/hospital', null, (p, _b, { now, today, studentId }) => {
        if (p.sick_since === null) return 'not_sick';
        if (severeAt(p) > now) return 'not_severe';
        if (dayRow(p, today)?.hospital) return 'already_hospital';
        if (!spendTopaz(studentId, PRICES.hospital, 'pet_hospital', p.id)) return 'insufficient_gems';
        markDay(p, 'hospital', today);
        db.prepare('UPDATE pets SET hospital_visits = hospital_visits + 1, updated_at = ? WHERE id = ?').run(now, p.id);
        return 'ok';
    });

    // 간식 {item} (하루 2번까지). 먹으면 한동안 기분좋음
    action('/pet/snack', ItemBody, (p, body, { now, today, studentId }) => {
        const s = SNACKS[body.item];
        if (!s) return 'unknown_item';
        if ((dayRow(p, today)?.snacks ?? 0) >= SNACKS_PER_DAY) return 'too_many_snacks';
        if (!spendTopaz(studentId, s.price, 'pet_snack', body.item)) return 'insufficient_gems';
        db.prepare(`
            INSERT INTO pet_days (pet_id, student_id, day, snacks) VALUES (?, ?, ?, 1)
            ON CONFLICT (pet_id, day) DO UPDATE SET snacks = snacks + 1
        `).run(p.id, p.student_id, today);
        db.prepare('UPDATE pets SET happy_until = ?, updated_at = ? WHERE id = ?')
            .run(Math.max(p.happy_until ?? 0, now + s.hours * H), now, p.id);
        return 'ok';
    });

    // 옷 사기 {item: 'top_tee_red'} — 지금 크기로. 사면 바로 입는다
    action('/pet/buy-clothes', ItemBody, (p, body, { now, studentId }) => {
        const c = clothInfo(body.item, p.stage);
        if (!c) return 'unknown_item';
        const key = `${body.item}@${p.stage}`;
        if (db.prepare('SELECT 1 FROM pet_items WHERE student_id = ? AND item_key = ?').get(studentId, key)) return 'already_owned';
        if (!spendTopaz(studentId, c.price, 'pet_clothes', key)) return 'insufficient_gems';
        db.prepare('INSERT INTO pet_items (student_id, item_key, created_at, placed) VALUES (?, ?, ?, 0)').run(studentId, key, now);
        db.prepare(`UPDATE pets SET ${c.slot === 'top' ? 'wear_top' : 'wear_hat'} = ?, updated_at = ? WHERE id = ?`).run(key, now, p.id);
        return 'ok';
    });

    // 옷 입기·벗기 {slot, item|null} — 지금 크기에 맞는 옷만
    action('/pet/wear', WearBody, (p, body, { now, studentId }) => {
        const col = body.slot === 'top' ? 'wear_top' : 'wear_hat';
        if (body.item === null) {
            db.prepare(`UPDATE pets SET ${col} = NULL, updated_at = ? WHERE id = ?`).run(now, p.id);
            return 'ok';
        }
        const c = clothInfo(body.item, p.stage);
        if (!c || c.slot !== body.slot) return 'unknown_item';
        const key = `${body.item}@${p.stage}`;
        if (!db.prepare('SELECT 1 FROM pet_items WHERE student_id = ? AND item_key = ?').get(studentId, key)) return 'not_owned';
        db.prepare(`UPDATE pets SET ${col} = ?, updated_at = ? WHERE id = ?`).run(key, now, p.id);
        return 'ok';
    });

    // 장난감·가구·능력 물건 사기 {item} (한 번 사면 계속). 자리가 있으면 방에, 없으면 창고에.
    // 벽지·쿠션은 사면 바로 바뀐다
    action('/pet/buy', ItemBody, (_p, body, { now, studentId }) => {
        const price = itemPrice(body.item);
        if (price === undefined) return 'unknown_item';
        if (db.prepare('SELECT 1 FROM pet_items WHERE student_id = ? AND item_key = ?').get(studentId, body.item)) return 'already_owned';
        if (!spendTopaz(studentId, price, 'pet_item', body.item)) return 'insufficient_gems';
        const place = PLACEABLE.has(body.item) && placedCount(studentId) < SLOTS[roomLevel(studentId)];
        db.prepare('INSERT INTO pet_items (student_id, item_key, created_at, placed, placed_at) VALUES (?, ?, ?, ?, ?)')
            .run(studentId, body.item, now, place ? 1 : 0, place ? now : null);
        ensureHome(studentId);
        if (body.item.startsWith('wall_')) db.prepare('UPDATE pet_home SET wallpaper = ?, updated_at = ? WHERE student_id = ?').run(body.item, now, studentId);
        if (body.item.startsWith('cushion_')) db.prepare('UPDATE pet_home SET cushion = ?, updated_at = ? WHERE student_id = ?').run(body.item, now, studentId);
        return 'ok';
    }, { allowEgg: true, allowGone: true });

    // 창고에서 꺼내기 / 넣기 {item, placed}
    action('/pet/place', PlaceBody, (_p, body, { studentId }) => {
        if (!PLACEABLE.has(body.item)) return 'not_placeable';
        const row = db.prepare('SELECT placed FROM pet_items WHERE student_id = ? AND item_key = ?').get(studentId, body.item) as { placed: number } | undefined;
        if (!row) return 'not_owned';
        if (body.placed && !row.placed && placedCount(studentId) >= SLOTS[roomLevel(studentId)]) return 'room_full';
        if (body.placed === !!row.placed) return 'ok';
        // 아픈 동안 침대·구급상자를 넣으면 그 자리에서 중병이 되거나 떠날 수 있다 → 못 넣게
        if (!body.placed && (body.item === 'bed' || body.item === 'firstaid') && _p.status === 'active' && _p.sick_since !== null) return 'sick_in_use';
        db.prepare('UPDATE pet_items SET placed = ?, placed_at = ? WHERE student_id = ? AND item_key = ?')
            .run(body.placed ? 1 : 0, body.placed ? Date.now() : null, studentId, body.item);
        return 'ok';
    }, { allowEgg: true, allowGone: true });

    // 가진 벽지·쿠션 고르기 {wallpaper?, cushion?} (null = 기본)
    action('/pet/decor', DecorBody, (_p, body, { now, studentId }) => {
        const mine = new Set(owned(studentId));
        for (const key of [body.wallpaper, body.cushion]) if (key && !mine.has(key)) return 'not_owned';
        ensureHome(studentId);
        if (body.wallpaper !== undefined) db.prepare('UPDATE pet_home SET wallpaper = ?, updated_at = ? WHERE student_id = ?').run(body.wallpaper, now, studentId);
        if (body.cushion !== undefined) db.prepare('UPDATE pet_home SET cushion = ?, updated_at = ? WHERE student_id = ?').run(body.cushion, now, studentId);
        return 'ok';
    }, { allowEgg: true, allowGone: true });

    // ── 알림: 아침 8시·오후 5시에 상태와 해 줄 일을 알려 준다 (2026-10-20 사용자 결정) ──
    // 펫 앱이 켜질 때 기기 토큰을 등록한다. 숙제앱 push_tokens 와는 따로 둔다
    app.post('/pet/push', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = PushBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        db.prepare(`INSERT INTO pet_push_tokens (token, student_id, updated_at) VALUES (?, ?, ?)
            ON CONFLICT (token) DO UPDATE SET student_id = excluded.student_id, updated_at = excluded.updated_at`)
            .run(parsed.data.token, req.user.id, Date.now());
        return { ok: true };
    });
    app.post('/pet/push/remove', { preHandler: auth }, async (req, reply) => {
        const parsed = PushBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        db.prepare('DELETE FROM pet_push_tokens WHERE token = ? AND student_id = ?').run(parsed.data.token, req.user.id);
        return { ok: true };
    });

    /** 알림 내용: 지금 상태 + 해 줄 일 */
    const notifyMessage = (studentId: string, slot: 'morning' | 'evening'): PushMessage => {
        const v = view(currentPet(studentId));
        const p = v.pet;
        const KO: Record<string, string> = { bear: '곰', dog: '강아지', cat: '고양이', rabbit: '토끼', squirrel: '다람쥐', hamster: '햄스터' };
        const name = p.name ?? (p.stage === 'egg' ? '알' : KO[p.species ?? ''] ?? '펫');
        const title = p.stage === 'egg' ? '🥚 알' : `🐾 ${name}`;
        // 받침이 있으면 '이', 없으면 '가'
        const code = name.charCodeAt(name.length - 1);
        const iga = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 ? '이' : '가';
        if (p.gone) return { title, body: `${name}${iga} 떠나며 편지를 남겼어요… ✉️`, data: { type: 'pet' } };
        const asks: string[] = [];
        let status: string;
        if (p.stage === 'egg') {
            status = p.growth.ready ? '알이 꿈틀꿈틀! 곧 깨어날 것 같아요 🐣' : '알이 따뜻하게 품어 주기를 기다려요';
            if (!p.patted_today) asks.push('🤲 품어 주기');
        } else {
            if (p.health?.severe) status = '많이 아파요 🤒';
            else if (p.health) status = '아파요 🤒';
            else if (p.fullness === 0) status = '배가 너무 고파요 😢';
            else status = ({ happy: '기분이 좋아요 😊', sad: '조금 우울해요 😢', angry: '밥을 걸러서 화났어요 😠', hungry: '배고파요 🍚' } as Record<string, string>)[p.mood]
                ?? (slot === 'morning' ? '좋은 아침이에요 ☀️' : '오늘 하루 어땠어요? 🌇');
            if (p.health?.severe && !p.health.visited_today) asks.push('🏥 병원 데려가기');
            else if (p.health && !p.health.severe && !p.health.med_given) asks.push('💊 약 주기');
            if (!p.fed_today) asks.push('🍚 밥 주기');
            if (p.poops.length) asks.push(`💩 똥 ${p.poops.length}개 치우기`);
            if (!p.patted_today) asks.push('🤚 쓰다듬기');
            if (v.room.can_upgrade) asks.push('🏠 방 넓혀 주기');
            if (p.growth.ready) asks.push('✨ 성장시키기');
        }
        const body = asks.length ? `${status}\n해 줄 일: ${asks.join(' · ')}` : `${status}\n오늘 할 일을 다 해 줬어요. 고마워요 💕`;
        return { title, body, data: { type: 'pet' } };
    };

    const notifyAll = async (slot: 'morning' | 'evening', day: string) => {
        const students = (db.prepare('SELECT DISTINCT student_id FROM pet_push_tokens').all() as { student_id: string }[]).map(r => r.student_id);
        for (const sid of students) {
            // 먼저 기록해서 두 번 보내지 않는다 (실패해도 다시 보내지 않는다 — 알림은 덤)
            const fresh = db.prepare('INSERT OR IGNORE INTO pet_notify_log (student_id, day, slot, sent_at) VALUES (?, ?, ?, ?)')
                .run(sid, day, slot, Date.now()).changes > 0;
            if (!fresh) continue;
            try {
                const msg = db.transaction(() => notifyMessage(sid, slot))();
                await sendPetPush(db, sid, msg);
            } catch (err) {
                app.log.error(err, 'pet notify failed');
            }
        }
    };
    // 1분마다 본다. 8시대·17시대 안이면 보낸다 (서버가 잠깐 꺼져 있었어도 그 한 시간 안에 켜지면 보낸다).
    // 시험 서버(DB 사본)는 PET_NOTIFY=off 로 띄울 것 — 진짜 기기로 알림이 간다
    if (process.env.PET_NOTIFY !== 'off') {
        const timer = setInterval(() => {
            const h = new Date(Date.now() + 9 * H).getUTCHours();
            const slot = h === 8 ? 'morning' : h === 17 ? 'evening' : null;
            if (slot) void notifyAll(slot, kstDay());
        }, 60_000);
        timer.unref();
    }

    // 방 꾸미기 저장 {layout: {key: {x, z, rot}}} — 겹치는지는 앱이 본다. 여기선 키와 범위만
    action('/pet/layout', LayoutBody, (_p, body, { now, studentId }) => {
        const keys = Object.keys(body.layout);
        if (keys.length > 20 || keys.some(k => !MOVABLE.has(k))) return 'unknown_item';
        ensureHome(studentId);
        db.prepare('UPDATE pet_home SET layout = ?, updated_at = ? WHERE student_id = ?').run(JSON.stringify(body.layout), now, studentId);
        return 'ok';
    }, { allowEgg: true, allowGone: true });

    // 돌봄 도우미 (🔶15, 일주일에 1번): 가장 최근의 빠진 날을 채운 날로 바꾼다
    action('/pet/helper', null, (p, _b, { today, studentId }) => {
        if (!helperReady(p, today)) return 'helper_cooldown';
        const day = lastMissedDay(p, today);
        if (!day) return 'no_missed_day';
        if (!spendTopaz(studentId, PRICES.helper, 'pet_helper', day)) return 'insufficient_gems';
        db.prepare(`
            INSERT INTO pet_days (pet_id, student_id, day, fed, patted, cleaned, helped) VALUES (?, ?, ?, 1, 1, 1, 1)
            ON CONFLICT (pet_id, day) DO UPDATE SET fed = 1, patted = 1, cleaned = 1, helped = 1
        `).run(p.id, p.student_id, day);
        db.prepare('UPDATE pets SET helper_day = ? WHERE id = ?').run(today, p.id);
        return 'ok';
    }, { allowEgg: true });

    // 졸업 (성인이 되면 아이가 누른다). 도감에 남기고 새 알을 무료로 받는다.
    // 방은 작은 방으로 돌아가고 물건은 가진 채로 모두 창고에 넣는다 (2026-10-21 사용자 결정). 자리도 기본 자리로
    action('/pet/graduate', null, (p, _b, { now, studentId }) => {
        if (p.stage !== 'adult') return 'not_adult';
        if (p.sick_since !== null) return 'sick';
        db.prepare("UPDATE pets SET status = 'graduated', graduated_at = ?, updated_at = ? WHERE id = ?").run(now, now, p.id);
        db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND cleaned_at IS NULL').run(now, p.id);
        ensureHome(studentId);
        db.prepare('UPDATE pet_home SET room_level = 0, layout = NULL, updated_at = ? WHERE student_id = ?').run(now, studentId);
        db.prepare('UPDATE pet_items SET placed = 0, placed_at = NULL WHERE student_id = ? AND placed = 1').run(studentId);
        newEgg(studentId);
        return 'ok';
    });

    // 새 알 (🔶20). 펫이 떠난 뒤에만
    action('/pet/new-egg', null, (p, _b, { now, studentId }) => {
        if (p.status !== 'gone') return 'not_gone';
        if (!spendTopaz(studentId, PRICES.new_egg, 'pet_new_egg', p.id)) return 'insufficient_gems';
        db.prepare("UPDATE pets SET status = 'left', updated_at = ? WHERE id = ?").run(now, p.id);
        db.prepare('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND cleaned_at IS NULL').run(now, p.id);
        newEgg(studentId);
        return 'ok';
    }, { allowGone: true, allowEgg: true });

    // ── 미니게임 똥피하기 ─────────────────────────
    const gamePlays = (studentId: string, today: string) =>
        (db.prepare('SELECT COUNT(*) AS n FROM pet_games WHERE student_id = ? AND day = ?').get(studentId, today) as { n: number }).n;
    /** 학생별 최고 기록 순위 (서버 전체) */
    const gameBoard = () => db.prepare(`
        SELECT g.student_id, u.name AS student, g.score_ms, g.species, g.variant, g.stage, p.name AS pet
        FROM pet_games g
        JOIN (SELECT student_id, MAX(score_ms) AS best FROM pet_games WHERE score_ms IS NOT NULL GROUP BY student_id) b
          ON b.student_id = g.student_id AND b.best = g.score_ms
        JOIN users u ON u.id = g.student_id
        LEFT JOIN pets p ON p.id = g.pet_id
        WHERE u.revoked_at IS NULL
        GROUP BY g.student_id
        ORDER BY g.score_ms DESC, MIN(g.ended_at)
    `).all() as { student_id: string; student: string; score_ms: number; species: string; variant: number; stage: string; pet: string | null }[];
    const gameView = (studentId: string) => {
        const today = kstDay();
        const board = gameBoard();
        const mine = board.findIndex(r => r.student_id === studentId);
        const strip = ({ student_id, ...r }: typeof board[number]) => ({ ...r, me: student_id === studentId });
        return {
            plays_left: Math.max(0, GAME_PER_DAY - gamePlays(studentId, today)),
            plays_per_day: GAME_PER_DAY,
            best: mine >= 0 ? board[mine].score_ms : null,
            rank: mine >= 0 ? mine + 1 : null,
            players: board.length,
            top: board.slice(0, 10).map(strip),
        };
    };

    // GET /pet/game — 남은 판수, 내 최고 기록, 순위 10등까지
    app.get('/pet/game', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        return gameView(req.user.id);
    });

    // POST /pet/game/start {pet_id} — 한 판 시작 (시작하면 판수가 줄어든다)
    app.post('/pet/game/start', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = GameStartBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const studentId = req.user.id;
        const r = db.transaction((): { error: string } | { id: string } => {
            const now = Date.now(), today = kstDay(now);
            if (gamePlays(studentId, today) >= GAME_PER_DAY) return { error: 'no_plays_left' };
            const p = db.prepare('SELECT * FROM pets WHERE id = ? AND student_id = ?').get(parsed.data.pet_id, studentId) as PetRow | undefined;
            if (!p) return { error: 'not_found' };
            let stage: string, build: string;
            if (p.status === 'graduated') {
                stage = 'adult'; build = 'normal';            // 도감의 펫은 졸업할 때 모습(어른, 보통 체형)
            } else if (p.status === 'active') {
                const v = view(evaluate(p)).pet;
                if (v.stage === 'egg') return { error: 'egg' };
                if (v.gone) return { error: 'gone' };
                if (v.mood === 'sick') return { error: 'sick' };
                if (v.mood === 'hungry') return { error: 'hungry' };
                stage = v.stage; build = v.build ?? 'normal';
            } else return { error: 'not_found' };
            const id = ulid();
            db.prepare(`INSERT INTO pet_games (id, student_id, pet_id, species, variant, stage, build, day, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, studentId, p.id, p.species, p.variant, stage, build, today, now);
            return { id };
        })();
        if ('error' in r) return reply.code(409).send(r);
        return { game: r, ...gameView(studentId) };
    });

    // POST /pet/game/end {id, score_ms} — 점수 기록. 지금 키우는 펫이 기분좋음 (보석은 없음)
    app.post('/pet/game/end', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const parsed = GameEndBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const studentId = req.user.id;
        const r = db.transaction((): string => {
            const now = Date.now();
            const g = db.prepare('SELECT * FROM pet_games WHERE id = ? AND student_id = ?').get(parsed.data.id, studentId) as
                { started_at: number; ended_at: number | null } | undefined;
            if (!g) return 'not_found';
            if (g.ended_at !== null) return 'already_ended';
            if (now - g.started_at > GAME_MAX_MS) return 'expired';
            // 실제로 지난 시간보다 오래 버틸 수는 없다
            if (parsed.data.score_ms > now - g.started_at + GAME_SLACK_MS) return 'bad_score';
            const score = parsed.data.score_ms;
            db.prepare('UPDATE pet_games SET ended_at = ?, score_ms = ? WHERE id = ?').run(now, score, parsed.data.id);
            // 기분좋음: 키우는 펫(알·떠남 제외)
            const p = db.prepare(`SELECT * FROM pets WHERE student_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`).get(studentId) as PetRow | undefined;
            if (p && p.stage !== 'egg') {
                db.prepare('UPDATE pets SET happy_until = ?, updated_at = ? WHERE id = ?')
                    .run(Math.max(p.happy_until ?? 0, now + GAME_HAPPY_H * H), now, p.id);
            }
            return 'ok';
        })();
        if (r !== 'ok') return reply.code(409).send({ error: r });
        return gameView(studentId);
    });

    // 시험 기능 {action} — PET_TEST_STUDENTS 에 있는 학생만
    app.post('/pet/test', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student' || !TESTERS.has(req.user.id)) return reply.code(403).send({ error: 'forbidden' });
        const parsed = TestBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
        const studentId = req.user.id;
        const result = db.transaction((): Result => {
            let p = db.prepare(`SELECT * FROM pets WHERE student_id = ? AND status IN ('active', 'gone') ORDER BY created_at DESC LIMIT 1`).get(studentId) as PetRow | undefined;
            if (!p) p = newEgg(studentId);
            const now = Date.now();
            const today = kstDay(now);
            const run = (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args);
            // 시간을 ms 만큼 앞으로 보낸다 = 기록을 그만큼 과거로 민다
            const shiftMs = (ms: number) => {
                run('UPDATE pets SET sick_since = sick_since - ?, happy_until = happy_until - ?, last_fed_at = last_fed_at - ?, created_at = created_at - ? WHERE id = ?', ms, ms, ms, ms, p!.id);
                run('UPDATE pet_poops SET at = at - ?, cleaned_at = cleaned_at - ? WHERE pet_id = ?', ms, ms, p!.id);
                // 능력 물건은 꺼낸 시각부터 작동하므로 같이 옮긴다 (안 옮기면 지난 밤 급식기·청소기가 건너뛴다)
                run('UPDATE pet_items SET placed_at = placed_at - ? WHERE student_id = ? AND placed_at IS NOT NULL', ms, studentId);
            };
            switch (parsed.data.action) {
                case 'next_day': {
                    // 날짜 기록을 하루씩 과거로 (기본키가 겹치지 않게 두 번에 나눠서)
                    shiftMs(DAY);
                    run("UPDATE pets SET stage_day = date(stage_day, '-1 day'), last_fed_day = date(last_fed_day, '-1 day'), helper_day = date(helper_day, '-1 day'), robot_day = date(robot_day, '-1 day') WHERE id = ?", p.id);
                    run("UPDATE pet_days SET day = 'x' || day WHERE pet_id = ?", p.id);
                    run("UPDATE pet_days SET day = date(substr(day, 2), '-1 day') WHERE pet_id = ?", p.id);
                    break;
                }
                case 'hours_8': shiftMs(8 * H); break;
                case 'fill': {
                    if (p.stage === 'adult') return 'adult';
                    const need = Math.max(...Object.entries(GROWTH[p.stage].need).filter(([k]) => k !== 'room').map(([, v]) => v!));
                    const start = addDays(today, -need - 1);   // 시작한 날은 안 세므로 하루 더 앞으로
                    run('UPDATE pets SET stage_day = ? WHERE id = ?', start, p.id);
                    for (let d = start; d < today; d = addDays(d, 1)) {
                        run(`INSERT INTO pet_days (pet_id, student_id, day, fed, patted, cleaned) VALUES (?, ?, ?, 1, 1, 1)
                             ON CONFLICT (pet_id, day) DO UPDATE SET fed = 1, patted = 1, cleaned = 1`, p.id, studentId, d);
                    }
                    if (p.stage !== 'egg' && !p.last_fed_day) run('UPDATE pets SET last_fed_day = ? WHERE id = ?', addDays(today, -1), p.id);
                    break;
                }
                case 'poop':
                case 'poop_old':
                    if (p.stage === 'egg') return 'egg';
                    run('INSERT INTO pet_poops (id, pet_id, student_id, at, u, v) VALUES (?, ?, ?, ?, ?, ?)',
                        ulid(), p.id, studentId, parsed.data.action === 'poop' ? now : now - DAY - H, Math.random(), Math.random());
                    break;
                case 'sick':
                case 'severe':
                    if (p.stage === 'egg') return 'egg';
                    run('UPDATE pets SET sick_since = ?, med_given = 0, hospital_visits = 0 WHERE id = ?', parsed.data.action === 'sick' ? now : now - DAY - H, p.id);
                    break;
                case 'heal':
                    run('UPDATE pets SET sick_since = NULL, med_given = 0, hospital_visits = 0 WHERE id = ?', p.id);
                    run('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND cleaned_at IS NULL', now, p.id);
                    if (p.stage !== 'egg') run('UPDATE pets SET last_fed_day = ? WHERE id = ?', today, p.id);
                    break;
                case 'leave':
                    if (p.stage === 'egg') return 'egg';
                    run("UPDATE pets SET status = 'gone', gone_at = ?, gone_reason = 'sick' WHERE id = ?", now, p.id);
                    break;
                case 'game_reset':    // 오늘 판수 되돌리기 (기록은 남긴다)
                    run("UPDATE pet_games SET day = date(day, '-1 day') WHERE student_id = ? AND day = ?", studentId, today);
                    break;
                case 'reset_today':
                    run('DELETE FROM pet_days WHERE pet_id = ? AND day = ?', p.id, today);
                    run('UPDATE pets SET happy_until = NULL WHERE id = ?', p.id);
                    break;
                case 'new_egg':
                    run("UPDATE pets SET status = 'left' WHERE id = ?", p.id);
                    run('UPDATE pet_poops SET cleaned_at = ? WHERE pet_id = ? AND cleaned_at IS NULL', now, p.id);
                    newEgg(studentId);
                    break;
                case 'next_look': {
                    // 종류·무늬를 차례로 바꿔 본다 (그림 확인용)
                    if (p.stage === 'egg') return 'egg';
                    const all = HATCHABLE.flatMap(sp => Array.from({ length: VARIANTS[sp] }, (_, v) => [sp, v] as const));
                    const i = all.findIndex(([sp, v]) => sp === p.species && v === p.variant);
                    const [sp, v] = all[(i + 1) % all.length];
                    run('UPDATE pets SET species = ?, variant = ? WHERE id = ?', sp, v, p.id);
                    break;
                }
                case 'notify':
                    // 지금 바로 알림 한 번 (내용 확인용, 기록은 남기지 않는다)
                    setTimeout(() => {
                        const h = new Date(Date.now() + 9 * H).getUTCHours();
                        const msg = db.transaction(() => notifyMessage(studentId, h < 12 ? 'morning' : 'evening'))();
                        app.log.info({ msg }, 'pet notify test');
                        void sendPetPush(db, studentId, msg);
                    }, 0);
                    break;
                case 'reset_items':
                    run('DELETE FROM pet_items WHERE student_id = ?', studentId);
                    run('DELETE FROM pet_home WHERE student_id = ?', studentId);
                    run('UPDATE pets SET wear_top = NULL, wear_hat = NULL WHERE id = ?', p.id);
                    break;
                default:
                    return 'unknown_action';
            }
            return 'ok';
        })();
        if (result !== 'ok') return reply.code(409).send({ error: result });
        return db.transaction(() => withGems(studentId))();
    });
}
