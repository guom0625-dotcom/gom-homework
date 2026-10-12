import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { monthProgress } from '../lib/gems.ts';
import { todayKST } from '../lib/days.ts';
import { sendPush } from '../lib/push.ts';

export function registerStudentRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /students  (manager only — 연결된 학생 + 다이아 잔고 + 오늘 할일 현황)
    app.get('/students', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });

        const students = db.prepare(`
            SELECT u.id, u.name, u.character, u.avatar,
                   COALESCE(gb.diamond, 0) AS diamonds,
                   (SELECT COUNT(*) FROM tasks t WHERE t.student_id = u.id AND t.day = ?) AS today_total,
                   (SELECT COUNT(*) FROM tasks t WHERE t.student_id = u.id
                      AND t.status IN ('plan_submitted', 'submitted', 'delete_requested')) AS pending_review,
                   gb.updated_at AS gems_updated_at
            FROM manager_student_link l
            JOIN users u ON u.id = l.student_id
            LEFT JOIN gems_balance gb ON gb.student_id = u.id
            WHERE l.manager_id = ?
            ORDER BY u.name
        `).all(todayKST(), req.user.id);

        return students;
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

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(id) as
            { push_token: string | null };
        const delivered = await sendPush(student.push_token, {
            title: '오늘의 할일을 등록해요 📝',
            body: `${req.user.name} 매니저가 기다리고 있어요`,
            data: { type: 'nudge_register' },
        });

        // delivered=false: 학생 폰에 알림이 아직 설정되지 않았거나 발송 실패
        return { ok: true, delivered };
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
