import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { monthProgress } from '../lib/gems.ts';
import { todayKST } from '../lib/days.ts';
import { sendPushToUser } from '../lib/push.ts';

export function registerStudentRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /students  (manager only — 연결된 학생 + 다이아 잔고 + 오늘 할일 현황)
    app.get('/students', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });

        const students = db.prepare(`
            SELECT u.id, u.name, u.character, u.avatar, u.created_at,
                   COALESCE(gb.diamond, 0) AS diamonds,
                   COALESCE(gb.ruby, 0) AS rubies,
                   COALESCE(gb.topaz, 0) AS topaz,
                   (SELECT COUNT(*) FROM books b WHERE b.student_id = u.id AND b.status = 'done_requested') AS pending_books,
                   (SELECT COUNT(*) FROM tasks t WHERE t.student_id = u.id AND t.day = ?) AS today_total,
                   (SELECT COUNT(*) FROM tasks t WHERE t.student_id = u.id
                      AND t.status IN ('plan_submitted', 'submitted', 'delete_requested')) AS pending_review,
                   gb.updated_at AS gems_updated_at
            FROM manager_student_link l
            JOIN users u ON u.id = l.student_id
            LEFT JOIN gems_balance gb ON gb.student_id = u.id
            WHERE l.manager_id = ?
            ORDER BY u.name
        `).all(todayKST(), req.user.id) as { created_at: number }[];

        return students.map(({ created_at, ...s }) => ({ ...s, joined_day: todayKST(created_at) }));
    });

    // POST /students/:id/nudge  (manager: 오늘 할일을 아직 등록하지 않은 학생에게 등록하라고 알림)
    app.post('/students/:id/nudge', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        const registered = db.prepare(
            'SELECT 1 FROM tasks WHERE student_id = ? AND day = ?'
        ).get(id, todayKST());
        if (registered) return reply.code(409).send({ error: 'already_registered' });

        const delivered = await sendPushToUser(db, id, {
            title: '오늘의 할일을 등록해요 📝',
            body: `${req.user.name}님이 기다리고 있어요`,
            data: { type: 'nudge_register' },
        });

        // delivered=false: 학생 폰에 알림이 아직 설정되지 않았거나 발송 실패
        return { ok: true, delivered };
    });

    // DELETE /students/:id  (manager: 학생 삭제 — 되돌릴 수 없음)
    // 연결을 끊고, 다른 매니저와도 연결돼 있지 않으면 계정과 그 학생의 모든 기록을 지운다
    app.delete('/students/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        const deleted = db.transaction(() => {
            db.prepare('DELETE FROM manager_student_link WHERE manager_id = ? AND student_id = ?')
                .run(req.user.id, id);
            const others = db.prepare('SELECT 1 FROM manager_student_link WHERE student_id = ?').get(id);
            if (others) return false;

            for (const table of ['tasks', 'books', 'owned_rewards', 'gem_transactions', 'gems_balance', 'auto_reward_rules', 'pairing_codes', 'room_items', 'room_style']) {
                db.prepare(`DELETE FROM ${table} WHERE student_id = ?`).run(id);
            }
            db.prepare('DELETE FROM auth_keys WHERE user_id = ?').run(id);
            db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(id);
            db.prepare('DELETE FROM users WHERE id = ?').run(id);
            return true;
        })();

        return { ok: true, account_deleted: deleted };
    });

    // PATCH /students/:id  (manager: rename student)
    app.patch('/students/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = z.object({ name: z.string().min(1).max(30) }).safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(body.data.name, id);
        return { ok: true };
    });

    // GET /students/:id/progress?month=YYYYMM  (manager: 특정 학생의 월별 날짜 현황)
    app.get('/students/:id/progress', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        const { month } = req.query as { month?: string };
        return monthProgress(db, id, Number(month) || Math.floor(todayKST() / 100));
    });
}
