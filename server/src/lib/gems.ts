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

/**
 * 하루 보상 정산: 그 날의 완료 마감시간이 지났고, 할일이 전부 승인됐고, 아직 지급 전이면 지급. 지급했으면 true.
 * 정기 정산뿐 아니라 매니저가 마감시간이 지난 뒤 늦게 승인한 경우에도 호출된다.
 */
export function settleDay(db: Db, studentId: string, day: number): boolean {
    if (!isDayClosed(studentDeadlines(db, studentId), day)) return false;
    return db.transaction(() => {
        if (!isDayDone(db, studentId, day)) return false;
        const settled = db.prepare(
            "SELECT 1 FROM gem_transactions WHERE student_id = ? AND reason = 'day_complete' AND ref_id = ?"
        ).get(studentId, String(day));
        if (settled) return false;

        const now = Date.now();
        db.prepare(
            'UPDATE gems_balance SET diamond = diamond + ?, updated_at = ? WHERE student_id = ?'
        ).run(DAY_REWARD, now, studentId);
        db.prepare(`
            INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
            VALUES (?, ?, ?, ?, 'day_complete', ?, ?)
        `).run(ulid(), studentId, GEM_TYPE, DAY_REWARD, String(day), now);
        return true;
    })();
}

/**
 * 할일이 전부 승인된 날 중 마감시간이 지난 것을 정산하고, 이번에 지급된 (학생, 날짜) 목록을 반환.
 * sinceDay 를 주면 그 날짜 이후만 본다 (주기 확인용 — 전체 훑기는 서버 시작 때 한 번).
 */
export function settlePastDays(db: Db, sinceDay = 0): { studentId: string; day: number }[] {
    const candidates = db.prepare(`
        SELECT student_id AS studentId, day FROM tasks
        WHERE day BETWEEN ? AND ?
        GROUP BY student_id, day
        HAVING SUM(status != 'approved') = 0
    `).all(sinceDay, todayKST()) as { studentId: string; day: number }[];
    return candidates.filter((c) => settleDay(db, c.studentId, c.day));
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
