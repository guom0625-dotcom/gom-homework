import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { addDays, todayKST, weekStartOf } from '../lib/days.ts';
import { dayStartMs } from '../lib/deadlines.ts';
import { currentStreak } from '../lib/gems.ts';
import { sendPushToUser } from '../lib/push.ts';

// 매니저 주간 리포트: 월~일 한 주 동안 학생별 할일·보석·책읽기 요약
export interface StudentWeek {
    id: string;
    name: string;
    days_with_tasks: number;  // 할일을 등록한 날
    days_done: number;        // 할일을 전부 승인받은 날
    diamonds: number;         // 이번 주에 받은 다이아 (연속 보너스 포함)
    rubies: number;           // 이번 주에 받은 루비
    books_done: number;       // 이번 주에 다 읽은 책
    streak: number;           // 지금 연속 달성 일수
}

const REPORT_HOUR_KST = 20;  // 일요일 저녁 8시에 보낸다
const WEEK_MS = 7 * 86_400_000;

export function weeklyReport(db: Db, managerId: string, weekStart: number): StudentWeek[] {
    const weekEnd = addDays(weekStart, 6);
    const fromMs = dayStartMs(weekStart);
    const toMs = fromMs + WEEK_MS;

    const students = db.prepare(`
        SELECT u.id, u.name FROM manager_student_link l
        JOIN users u ON u.id = l.student_id
        WHERE l.manager_id = ? ORDER BY u.name
    `).all(managerId) as { id: string; name: string }[];

    return students.map((st) => {
        const days = db.prepare(`
            SELECT COUNT(*) AS with_tasks, COALESCE(SUM(done), 0) AS done FROM (
                SELECT day, SUM(status != 'approved') = 0 AS done FROM tasks
                WHERE student_id = ? AND day BETWEEN ? AND ?
                GROUP BY day
            )
        `).get(st.id, weekStart, weekEnd) as { with_tasks: number; done: number };
        const gems = db.prepare(`
            SELECT COALESCE(SUM(CASE WHEN gem_type = 'diamond' THEN delta END), 0) AS diamonds,
                   COALESCE(SUM(CASE WHEN gem_type = 'ruby' THEN delta END), 0) AS rubies
            FROM gem_transactions
            WHERE student_id = ? AND delta > 0 AND created_at >= ? AND created_at < ?
        `).get(st.id, fromMs, toMs) as { diamonds: number; rubies: number };
        const books = db.prepare(`
            SELECT COUNT(*) AS n FROM books
            WHERE student_id = ? AND status = 'done' AND done_at >= ? AND done_at < ?
        `).get(st.id, fromMs, toMs) as { n: number };

        return {
            ...st,
            days_with_tasks: days.with_tasks,
            days_done: days.done,
            diamonds: gems.diamonds,
            rubies: gems.rubies,
            books_done: books.n,
            streak: currentStreak(db, st.id),
        };
    });
}

/**
 * 일요일 저녁 8시가 지났으면 이번 주 리포트를 매니저에게 푸시 (매니저마다 주 1회).
 * 서버 폰이 절전 중이었다면 깨어난 뒤 12시간 안에는 늦게라도 보낸다. 정산 주기(1분)마다 호출된다.
 */
export function sendWeeklyReports(db: Db, now: number = Date.now()): void {
    const today = todayKST(now);
    const lastSunday = addDays(weekStartOf(today), -1);
    const thisSunday = addDays(weekStartOf(today), 6);
    // 가장 최근에 리포트를 보냈어야 하는 일요일
    const sunday = now >= dayStartMs(thisSunday) + REPORT_HOUR_KST * 3_600_000 ? thisSunday : lastSunday;
    const dueAt = dayStartMs(sunday) + REPORT_HOUR_KST * 3_600_000;
    if (now < dueAt || now - dueAt > 12 * 3_600_000) return;

    const weekStart = weekStartOf(sunday);
    const managers = db.prepare(`
        SELECT DISTINCT l.manager_id AS id FROM manager_student_link l
        WHERE NOT EXISTS (
            SELECT 1 FROM weekly_report_log r WHERE r.manager_id = l.manager_id AND r.week_start = ?
        )
    `).all(weekStart) as { id: string }[];

    for (const m of managers) {
        db.prepare('INSERT OR IGNORE INTO weekly_report_log (manager_id, week_start, sent_at) VALUES (?, ?, ?)')
            .run(m.id, weekStart, now);
        const lines = weeklyReport(db, m.id, weekStart).map((s) =>
            `${s.name}: 할일 ${s.days_done}/7일 · 💎${s.diamonds} · 책 ${s.books_done}권 · 🔥${s.streak}일`
        );
        if (lines.length === 0) continue;
        void sendPushToUser(db, m.id, {
            title: '📊 이번 주 리포트',
            body: lines.join('\n'),
            data: { type: 'weekly_report', week_start: weekStart },
        });
    }
}

export function registerReportRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /report/weekly?week_start=YYYYMMDD  (manager only — 기본은 이번 주)
    app.get('/report/weekly', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { week_start } = req.query as { week_start?: string };
        const weekStart = weekStartOf(Number(week_start) || todayKST());
        return {
            week_start: weekStart,
            week_end: addDays(weekStart, 6),
            students: weeklyReport(db, req.user.id, weekStart),
        };
    });
}
