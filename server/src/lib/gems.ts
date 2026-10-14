import { ulid } from 'ulid';
import type { Db } from '../db.ts';
import { prevDay, todayKST } from './days.ts';
import { isDayClosed, studentDeadlines } from './deadlines.ts';

// 보석은 다이아 한 종류. 하루 할일이 전부 승인된 날은, 그 날의 완료 마감시간(매니저 설정)에 DAY_REWARD개 지급.
export const GEM_TYPE = 'diamond';
export const DAY_REWARD = 1;

function isDayDone(db: Db, studentId: string, day: number): boolean {
    const row = db.prepare(`
        SELECT COUNT(*) AS total, COALESCE(SUM(status = 'approved'), 0) AS approved
        FROM tasks WHERE student_id = ? AND day = ?
    `).get(studentId, day) as { total: number; approved: number };
    return row.total > 0 && row.total === row.approved;
}

// 연속 달성 보너스: 할일을 전부 승인받은 날이 N일 연속이 되는 날 다이아 지급 (1주부터 두 배씩, 64주까지)
export const STREAK_BONUS: Record<number, number> = {
    7: 1, 14: 2, 28: 4, 56: 8, 112: 16, 224: 32, 448: 64,
};

export interface SettleResult {
    streakDays: number;    // 이 날까지 연속으로 다 끝낸 날 수
    bonusDiamonds: number; // 이번에 받은 연속 달성 보너스 (없으면 0)
}

/** day 를 포함해 거꾸로 세어 할일을 전부 승인받은 날이 며칠 연속인지 */
function streakEndingAt(db: Db, studentId: string, day: number): number {
    const done = new Set(
        (db.prepare(`
            SELECT day FROM tasks WHERE student_id = ? AND day <= ?
            GROUP BY day HAVING SUM(status != 'approved') = 0
            ORDER BY day DESC LIMIT 500
        `).all(studentId, day) as { day: number }[]).map((r) => r.day),
    );
    let streak = 0;
    for (let d = day; done.has(d); d = prevDay(d)) streak++;
    return streak;
}

/**
 * 하루 보상 정산: 그 날의 완료 마감시간이 지났고, 할일이 전부 승인됐고, 아직 지급 전이면 다이아 지급.
 * 그 날로 연속 달성 일수가 보너스 기준(7·14·28…일)에 닿으면 보너스도 같이 지급한다.
 * 지급했으면 결과를, 아니면 null.
 * 정기 정산뿐 아니라 매니저가 마감시간이 지난 뒤 늦게 승인한 경우에도 호출된다.
 * (늦은 승인으로 이미 지나간 날 사이의 빈칸이 메워져도, 그 뒤 날들의 보너스를 소급해 주지는 않는다)
 */
export function settleDay(db: Db, studentId: string, day: number): SettleResult | null {
    if (!isDayClosed(studentDeadlines(db, studentId), day)) return null;
    return db.transaction((): SettleResult | null => {
        if (!isDayDone(db, studentId, day)) return null;
        const settled = db.prepare(
            "SELECT 1 FROM gem_transactions WHERE student_id = ? AND reason = 'day_complete' AND ref_id = ?"
        ).get(studentId, String(day));
        if (settled) return null;

        const now = Date.now();
        const streakDays = streakEndingAt(db, studentId, day);
        const bonusDiamonds = STREAK_BONUS[streakDays] ?? 0;

        db.prepare(
            'UPDATE gems_balance SET diamond = diamond + ?, updated_at = ? WHERE student_id = ?'
        ).run(DAY_REWARD + bonusDiamonds, now, studentId);
        const log = db.prepare(`
            INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        log.run(ulid(), studentId, GEM_TYPE, DAY_REWARD, 'day_complete', String(day), now);
        if (bonusDiamonds > 0) {
            log.run(ulid(), studentId, GEM_TYPE, bonusDiamonds, 'streak_bonus', `${day}:${streakDays}`, now);
        }
        return { streakDays, bonusDiamonds };
    })();
}

/**
 * 할일이 전부 승인된 날 중 마감시간이 지난 것을 정산하고, 이번에 지급된 목록을 반환.
 * sinceDay 를 주면 그 날짜 이후만 본다 (주기 확인용 — 전체 훑기는 서버 시작 때 한 번).
 * 오래된 날부터 정산해야 연속 일수가 맞게 계산된다.
 */
export function settlePastDays(db: Db, sinceDay = 0): ({ studentId: string; day: number } & SettleResult)[] {
    const candidates = db.prepare(`
        SELECT student_id AS studentId, day FROM tasks
        WHERE day BETWEEN ? AND ?
        GROUP BY student_id, day
        HAVING SUM(status != 'approved') = 0
        ORDER BY day ASC
    `).all(sinceDay, todayKST()) as { studentId: string; day: number }[];
    const paid: ({ studentId: string; day: number } & SettleResult)[] = [];
    for (const c of candidates) {
        const r = settleDay(db, c.studentId, c.day);
        if (r) paid.push({ ...c, ...r });
    }
    return paid;
}

/** 할일을 전부 승인받은 날이 며칠 연속인지 (오늘이 아직 진행 중이면 어제부터 센다) */
export function currentStreak(db: Db, studentId: string): number {
    const done = new Set(
        (db.prepare(`
            SELECT day FROM tasks WHERE student_id = ?
            GROUP BY day HAVING SUM(status != 'approved') = 0
        `).all(studentId) as { day: number }[]).map((r) => r.day),
    );
    let day = todayKST();
    if (!done.has(day)) day = prevDay(day);
    let streak = 0;
    while (done.has(day)) { streak++; day = prevDay(day); }
    return streak;
}

export interface DaySummary { day: number; total: number; approved: number; rewarded: number }

/** month = YYYYMM. 할일이 있는 날짜만 반환 */
export function monthProgress(db: Db, studentId: string, month: number): DaySummary[] {
    return db.prepare(`
        SELECT t.day, COUNT(*) AS total, SUM(t.status = 'approved') AS approved,
               EXISTS(
                   SELECT 1 FROM gem_transactions g
                   WHERE g.student_id = t.student_id AND g.reason = 'day_complete'
                     AND g.ref_id = CAST(t.day AS TEXT) AND g.delta > 0
               ) AS rewarded
        FROM tasks t
        WHERE t.student_id = ? AND t.day BETWEEN ? AND ?
        GROUP BY t.day ORDER BY t.day
    `).all(studentId, month * 100 + 1, month * 100 + 31) as DaySummary[];
}
