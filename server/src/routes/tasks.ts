import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { DAY_REWARD, settleDay } from '../lib/gems.ts';
import { todayKST } from '../lib/days.ts';
import { canRegister, isDayClosed, studentDeadlines } from '../lib/deadlines.ts';
import { sendPush } from '../lib/push.ts';

const CreateBody = z.object({
    day: z.number().int().positive(),
    title: z.string().min(1).max(100),
    memo: z.string().max(500).optional(),
});

const EditBody = z.object({
    title: z.string().min(1).max(100),
    memo: z.string().max(500).nullable().optional(),
});

const RejectBody = z.object({
    reason: z.string().max(200).optional(),
});

interface TaskRow {
    id: string;
    student_id: string;
    day: number;
    title: string;
    status: string;
    prev_status: string | null;
}

export function registerTaskRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    const isLinked = (managerId: string, studentId: string): boolean =>
        !!db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(managerId, studentId);

    const managerPushToken = (studentId: string): string | null | undefined =>
        (db.prepare(`
            SELECT u.push_token FROM manager_student_link l
            JOIN users u ON u.id = l.manager_id
            WHERE l.student_id = ?
        `).get(studentId) as { push_token: string | null } | undefined)?.push_token;

    const userPushToken = (userId: string): string | null =>
        (db.prepare('SELECT push_token FROM users WHERE id = ?').get(userId) as { push_token: string | null }).push_token;

    const userName = (userId: string): string =>
        (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string }).name;

    // 학생 본인의 할일. 학생은 그 날의 완료 마감시간 전까지만 손댈 수 있다 (그 뒤엔 매니저 검토만 남음)
    const ownTask = (id: string, studentId: string): TaskRow | undefined =>
        db.prepare('SELECT * FROM tasks WHERE id = ? AND student_id = ?').get(id, studentId) as TaskRow | undefined;

    const dayClosed = (studentId: string, day: number): boolean =>
        isDayClosed(studentDeadlines(db, studentId), day);

    // 매니저가 검토할 수 있는 (연결된 학생의) 할일
    const reviewableTask = (id: string, managerId: string): TaskRow | 'not_found' | 'forbidden' => {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
        if (!task) return 'not_found';
        return isLinked(managerId, task.student_id) ? task : 'forbidden';
    };

    // GET /tasks?day=YYYYMMDD&student_id=xxx  (student sees own; manager sees linked student's)
    // GET /tasks?from=YYYYMMDD&student_id=xxx → { tasks, older_day }
    //   from 이후 날짜의 할일 + 날짜와 무관하게 매니저 검토를 기다리는 할일. older_day = 그보다 앞선 가장 최근 날짜(없으면 null)
    app.get('/tasks', { preHandler: auth }, async (req, reply) => {
        const { day, from, student_id } = req.query as { day?: string; from?: string; student_id?: string };

        let targetId: string;
        if (req.user.role === 'student') {
            targetId = req.user.id;
        } else {
            if (!student_id) return reply.code(400).send({ error: 'student_id required' });
            if (!isLinked(req.user.id, student_id)) return reply.code(403).send({ error: 'forbidden' });
            targetId = student_id;
        }

        if (from) {
            const pending = "status IN ('plan_submitted', 'submitted', 'delete_requested')";
            const tasks = db.prepare(
                `SELECT * FROM tasks WHERE student_id = ? AND (day >= ? OR ${pending}) ORDER BY created_at ASC`
            ).all(targetId, Number(from));
            const older = db.prepare(
                `SELECT MAX(day) AS day FROM tasks WHERE student_id = ? AND day < ? AND NOT ${pending}`
            ).get(targetId, Number(from)) as { day: number | null };
            return { tasks, older_day: older.day };
        }

        let sql = 'SELECT * FROM tasks WHERE student_id = ?';
        const params: unknown[] = [targetId];
        if (day) { sql += ' AND day = ?'; params.push(Number(day)); }
        sql += ' ORDER BY created_at ASC';

        return db.prepare(sql).all(...params);
    });

    // POST /tasks  (student only — 오늘 날짜에. 등록 마감이 지났어도 오늘 등록해 둔 할일이 있으면 완료 마감 전까지 추가 가능)
    // 등록과 동시에 계획이 상신된다(plan_submitted). 반려되면 학생이 submit-plan 으로 다시 상신.
    app.post('/tasks', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const body = CreateBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const { day, title, memo } = body.data;
        if (day !== todayKST()) return reply.code(409).send({ error: 'not_today' });
        const hasTasks = !!db.prepare('SELECT 1 FROM tasks WHERE student_id = ? AND day = ?').get(req.user.id, day);
        if (!canRegister(studentDeadlines(db, req.user.id), day, hasTasks)) {
            return reply.code(409).send({ error: 'register_closed' });
        }

        const id = ulid();
        db.prepare(`
            INSERT INTO tasks (id, student_id, day, title, memo, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'plan_submitted', ?)
        `).run(id, req.user.id, day, title, memo ?? null, Date.now());

        await sendPush(managerPushToken(req.user.id), {
            title: `${userName(req.user.id)}의 계획 상신`,
            body: title,
            data: { type: 'plan_submitted', task_id: id },
        });

        return reply.code(201).send(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    });

    // PATCH /tasks/:id  (student only — 반려된 계획을 고쳐서 다시 상신: plan_rejected/todo → plan_submitted)
    app.patch('/tasks/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = EditBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const task = ownTask(id, req.user.id);
        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (dayClosed(req.user.id, task.day)) return reply.code(409).send({ error: 'day_passed' });
        if (task.status !== 'todo' && task.status !== 'plan_rejected') {
            return reply.code(409).send({ error: 'cannot_edit' });
        }

        db.prepare(
            "UPDATE tasks SET title = ?, memo = ?, status = 'plan_submitted' WHERE id = ?"
        ).run(body.data.title, body.data.memo ?? null, id);

        await sendPush(managerPushToken(req.user.id), {
            title: `${userName(req.user.id)}의 계획 수정 상신`,
            body: body.data.title,
            data: { type: 'plan_submitted', task_id: id },
        });

        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    });

    // POST /tasks/:id/submit-plan  (student only — todo/plan_rejected → plan_submitted)
    app.post('/tasks/:id/submit-plan', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = ownTask(id, req.user.id);
        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (dayClosed(req.user.id, task.day)) return reply.code(409).send({ error: 'day_passed' });
        if (task.status !== 'todo' && task.status !== 'plan_rejected') {
            return reply.code(409).send({ error: 'cannot_submit_plan' });
        }

        db.prepare("UPDATE tasks SET status = 'plan_submitted' WHERE id = ?").run(id);

        await sendPush(managerPushToken(req.user.id), {
            title: `${userName(req.user.id)}의 계획 상신`,
            body: task.title,
            data: { type: 'plan_submitted', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/approve-plan  (manager only)
    app.post('/tasks/:id/approve-plan', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'plan_submitted') return reply.code(409).send({ error: 'not_plan_submitted' });

        db.prepare(
            "UPDATE tasks SET status = 'plan_approved', reviewed_at = ? WHERE id = ?"
        ).run(Date.now(), id);

        await sendPush(userPushToken(task.student_id), {
            title: '계획 승인!',
            body: `"${task.title}" 이제 실행해봐요`,
            data: { type: 'plan_approved', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/reject-plan  (manager only)
    app.post('/tasks/:id/reject-plan', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = RejectBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'plan_submitted') return reply.code(409).send({ error: 'not_plan_submitted' });

        db.prepare(
            "UPDATE tasks SET status = 'plan_rejected', reviewed_at = ? WHERE id = ?"
        ).run(Date.now(), id);

        await sendPush(userPushToken(task.student_id), {
            title: '계획 수정이 필요해요',
            body: `"${task.title}" — ${body.data.reason ?? '계획을 수정하고 다시 상신해주세요'}`,
            data: { type: 'plan_rejected', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/submit  (student only — plan_approved/rejected → submitted)
    app.post('/tasks/:id/submit', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = ownTask(id, req.user.id);
        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (dayClosed(req.user.id, task.day)) return reply.code(409).send({ error: 'day_passed' });
        if (task.status !== 'plan_approved' && task.status !== 'rejected') {
            return reply.code(409).send({ error: 'cannot_submit' });
        }

        db.prepare(
            "UPDATE tasks SET status = 'submitted', submitted_at = ? WHERE id = ?"
        ).run(Date.now(), id);

        await sendPush(managerPushToken(req.user.id), {
            title: `${userName(req.user.id)}가 제출했어요`,
            body: task.title,
            data: { type: 'task_submitted', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/approve  (manager only)
    // 보상은 여기서 주지 않는다 — 날짜가 바뀐 뒤 자동 정산. 단, 이미 지난 날을 늦게 승인한 경우엔 바로 정산.
    app.post('/tasks/:id/approve', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'submitted') return reply.code(409).send({ error: 'not_submitted' });

        db.prepare(
            "UPDATE tasks SET status = 'approved', reviewed_at = ? WHERE id = ?"
        ).run(Date.now(), id);
        const dayRewarded = settleDay(db, task.student_id, task.day);

        await sendPush(userPushToken(task.student_id), {
            title: '할일 승인!',
            body: dayRewarded ? `"${task.title}" 완료 — 다이아 ${DAY_REWARD}개를 받았어요` : `"${task.title}" 완료`,
            data: { type: 'task_approved', task_id: id },
        });

        return { ok: true, day_rewarded: dayRewarded };
    });

    // POST /tasks/:id/reject  (manager only)
    app.post('/tasks/:id/reject', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = RejectBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'submitted') return reply.code(409).send({ error: 'not_submitted' });

        db.prepare(
            "UPDATE tasks SET status = 'rejected', reviewed_at = ? WHERE id = ?"
        ).run(Date.now(), id);

        await sendPush(userPushToken(task.student_id), {
            title: '다시 확인해봐요',
            body: `"${task.title}" — ${body.data.reason ?? '수정 후 다시 제출해주세요'}`,
            data: { type: 'task_rejected', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/request-delete  (student only — 삭제는 매니저 승인 필요)
    app.post('/tasks/:id/request-delete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = ownTask(id, req.user.id);
        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (dayClosed(req.user.id, task.day)) return reply.code(409).send({ error: 'day_passed' });
        if (task.status === 'approved' || task.status === 'delete_requested') {
            return reply.code(409).send({ error: 'cannot_delete' });
        }

        db.prepare(
            "UPDATE tasks SET status = 'delete_requested', prev_status = ? WHERE id = ?"
        ).run(task.status, id);

        await sendPush(managerPushToken(req.user.id), {
            title: `${userName(req.user.id)}의 할일 삭제 요청`,
            body: task.title,
            data: { type: 'delete_requested', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/cancel-delete  (student only — 삭제 요청 취소)
    app.post('/tasks/:id/cancel-delete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = ownTask(id, req.user.id);
        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (task.status !== 'delete_requested') return reply.code(409).send({ error: 'not_delete_requested' });

        const restored = task.prev_status ?? 'todo';
        db.prepare('UPDATE tasks SET status = ?, prev_status = NULL WHERE id = ?').run(restored, id);
        return { ok: true, status: restored };
    });

    // POST /tasks/:id/approve-delete  (manager only — 실제 삭제)
    app.post('/tasks/:id/approve-delete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'delete_requested') return reply.code(409).send({ error: 'not_delete_requested' });

        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        // 지난 날의 마지막 미결 할일이 사라져 남은 게 전부 승인 상태가 됐으면 정산
        const dayRewarded = settleDay(db, task.student_id, task.day);

        await sendPush(userPushToken(task.student_id), {
            title: '할일 삭제 승인',
            body: `"${task.title}" 삭제됐어요`,
            data: { type: 'delete_approved', task_id: id },
        });

        return { ok: true, day_rewarded: dayRewarded };
    });

    // POST /tasks/:id/reject-delete  (manager only — 삭제 요청 전 상태로 복구)
    app.post('/tasks/:id/reject-delete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = reviewableTask(id, req.user.id);
        if (task === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (task === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (task.status !== 'delete_requested') return reply.code(409).send({ error: 'not_delete_requested' });

        const restored = task.prev_status ?? 'todo';
        db.prepare('UPDATE tasks SET status = ?, prev_status = NULL WHERE id = ?').run(restored, id);

        await sendPush(userPushToken(task.student_id), {
            title: '할일 삭제가 반려됐어요',
            body: `"${task.title}" 은(는) 그대로 해야 해요`,
            data: { type: 'delete_rejected', task_id: id },
        });

        return { ok: true, status: restored };
    });
}
