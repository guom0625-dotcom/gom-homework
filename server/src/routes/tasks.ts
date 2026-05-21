import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPES, type GemType } from '../lib/gems.ts';
import { sendPush } from '../lib/push.ts';

const CreateBody = z.object({
    day: z.number().int().positive(),
    title: z.string().min(1).max(100),
    memo: z.string().max(500).optional(),
});

const ApproveBody = z.object({
    gem_type: z.enum(GEM_TYPES),
    gem_amount: z.number().int().positive(),
});

const RejectBody = z.object({
    reason: z.string().max(200).optional(),
});

function getOrCreateDayProgress(db: Db, studentId: string, day: number): void {
    db.prepare(`
        INSERT OR IGNORE INTO day_progress (student_id, day, status, updated_at)
        VALUES (?, ?, 'todo', ?)
    `).run(studentId, day, Date.now());
}

function recalcDayStatus(db: Db, studentId: string, day: number): void {
    const tasks = db.prepare(
        'SELECT status FROM tasks WHERE student_id = ? AND day = ?'
    ).all(studentId, day) as { status: string }[];

    if (tasks.length === 0) return;

    let status: string;
    if (tasks.every((t) => t.status === 'approved')) {
        status = 'approved';
    } else if (tasks.every((t) => t.status === 'todo')) {
        status = 'todo';
    } else {
        status = 'pending';
    }

    db.prepare(
        'UPDATE day_progress SET status = ?, updated_at = ? WHERE student_id = ? AND day = ?'
    ).run(status, Date.now(), studentId, day);
}

export function registerTaskRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /tasks?day=N&student_id=xxx  (student sees own; manager sees linked student's)
    app.get('/tasks', { preHandler: auth }, async (req, reply) => {
        const { day, student_id } = req.query as { day?: string; student_id?: string };

        let targetId: string;
        if (req.user.role === 'student') {
            targetId = req.user.id;
        } else {
            if (!student_id) return reply.code(400).send({ error: 'student_id required' });
            const link = db.prepare(
                'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
            ).get(req.user.id, student_id);
            if (!link) return reply.code(403).send({ error: 'forbidden' });
            targetId = student_id;
        }

        let sql = 'SELECT * FROM tasks WHERE student_id = ?';
        const params: unknown[] = [targetId];
        if (day) { sql += ' AND day = ?'; params.push(Number(day)); }
        sql += ' ORDER BY created_at ASC';

        return db.prepare(sql).all(...params);
    });

    // POST /tasks  (student only)
    app.post('/tasks', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const body = CreateBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const { day, title, memo } = body.data;
        const id = ulid();
        const now = Date.now();

        db.prepare(`
            INSERT INTO tasks (id, student_id, day, title, memo, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'todo', ?)
        `).run(id, req.user.id, day, title, memo ?? null, now);

        getOrCreateDayProgress(db, req.user.id, day);

        const manager = db.prepare(`
            SELECT u.push_token FROM manager_student_link l
            JOIN users u ON u.id = l.manager_id
            WHERE l.student_id = ?
        `).get(req.user.id) as { push_token: string | null } | undefined;

        const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id) as { name: string };
        await sendPush(manager?.push_token, {
            title: `${student.name}의 할일 등록`,
            body: `Day ${day}: ${title}`,
            data: { type: 'task_created', task_id: id },
        });

        return reply.code(201).send(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    });

    // POST /tasks/:id/submit-plan  (student only — todo/plan_rejected → plan_submitted)
    app.post('/tasks/:id/submit-plan', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = db.prepare(
            'SELECT * FROM tasks WHERE id = ? AND student_id = ?'
        ).get(id, req.user.id) as { status: string; day: number; title: string } | undefined;

        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (task.status !== 'todo' && task.status !== 'plan_rejected') {
            return reply.code(409).send({ error: 'cannot_submit_plan' });
        }

        db.transaction(() => {
            db.prepare(
                "UPDATE tasks SET status = 'plan_submitted' WHERE id = ?"
            ).run(id);
            recalcDayStatus(db, req.user.id, task.day);
        })();

        const manager = db.prepare(`
            SELECT u.push_token FROM manager_student_link l
            JOIN users u ON u.id = l.manager_id
            WHERE l.student_id = ?
        `).get(req.user.id) as { push_token: string | null } | undefined;

        const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id) as { name: string };
        await sendPush(manager?.push_token, {
            title: `${student.name}의 계획 상신`,
            body: task.title,
            data: { type: 'plan_submitted', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/approve-plan  (manager only)
    app.post('/tasks/:id/approve-plan', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
            { student_id: string; status: string; day: number; title: string } | undefined;
        if (!task) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, task.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        if (task.status !== 'plan_submitted') return reply.code(409).send({ error: 'not_plan_submitted' });

        db.transaction(() => {
            db.prepare(
                "UPDATE tasks SET status = 'plan_approved', reviewed_at = ? WHERE id = ?"
            ).run(Date.now(), id);
            recalcDayStatus(db, task.student_id, task.day);
        })();

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(task.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
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

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
            { student_id: string; status: string; day: number; title: string } | undefined;
        if (!task) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, task.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        if (task.status !== 'plan_submitted') return reply.code(409).send({ error: 'not_plan_submitted' });

        db.transaction(() => {
            db.prepare(
                "UPDATE tasks SET status = 'plan_rejected', reviewed_at = ? WHERE id = ?"
            ).run(Date.now(), id);
            recalcDayStatus(db, task.student_id, task.day);
        })();

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(task.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
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

        const task = db.prepare(
            'SELECT * FROM tasks WHERE id = ? AND student_id = ?'
        ).get(id, req.user.id) as { status: string; day: number; title: string } | undefined;

        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (task.status !== 'plan_approved' && task.status !== 'rejected') {
            return reply.code(409).send({ error: 'cannot_submit' });
        }

        const now = Date.now();
        db.transaction(() => {
            db.prepare(
                'UPDATE tasks SET status = \'submitted\', submitted_at = ? WHERE id = ?'
            ).run(now, id);
            recalcDayStatus(db, req.user.id, task.day);
        })();

        const manager = db.prepare(`
            SELECT u.push_token FROM manager_student_link l
            JOIN users u ON u.id = l.manager_id
            WHERE l.student_id = ?
        `).get(req.user.id) as { push_token: string | null } | undefined;

        const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id) as { name: string };
        await sendPush(manager?.push_token, {
            title: `${student.name}가 제출했어요`,
            body: task.title,
            data: { type: 'task_submitted', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/approve  (manager only)
    app.post('/tasks/:id/approve', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = ApproveBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
            { student_id: string; status: string; day: number; title: string } | undefined;
        if (!task) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, task.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        if (task.status !== 'submitted') return reply.code(409).send({ error: 'not_submitted' });

        const { gem_type, gem_amount } = body.data;
        const now = Date.now();
        const txId = ulid();

        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE tasks SET status = 'approved', gem_type = ?, gem_amount = ?, reviewed_at = ?
                WHERE id = ?
            `).run(gem_type, gem_amount, now, id);

            db.prepare(`
                UPDATE gems_balance SET ${gem_type} = ${gem_type} + ?, updated_at = ?
                WHERE student_id = ?
            `).run(gem_amount, now, task.student_id);

            db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, ?, ?, 'task_approve', ?, ?)
            `).run(txId, task.student_id, gem_type, gem_amount, id, now);

            recalcDayStatus(db, task.student_id, task.day);
        });
        tx();

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(task.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
            title: '할일 승인!',
            body: `"${task.title}" 완료 — ${gem_type} ${gem_amount}개`,
            data: { type: 'task_approved', task_id: id },
        });

        return { ok: true };
    });

    // POST /tasks/:id/reject  (manager only)
    app.post('/tasks/:id/reject', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = RejectBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
            { student_id: string; status: string; day: number; title: string } | undefined;
        if (!task) return reply.code(404).send({ error: 'not_found' });

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, task.student_id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        if (task.status !== 'submitted') return reply.code(409).send({ error: 'not_submitted' });

        const now = Date.now();
        db.transaction(() => {
            db.prepare(
                'UPDATE tasks SET status = \'rejected\', reviewed_at = ? WHERE id = ?'
            ).run(now, id);
            recalcDayStatus(db, task.student_id, task.day);
        })();

        const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(task.student_id) as
            { push_token: string | null };
        await sendPush(student.push_token, {
            title: '다시 확인해봐요',
            body: `"${task.title}" — ${body.data.reason ?? '수정 후 다시 제출해주세요'}`,
            data: { type: 'task_rejected', task_id: id },
        });

        return { ok: true };
    });

    // POST /day/:day/complete  (student only — advance day after manager approval)
    app.post('/day/:day/complete', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const day = Number((req.params as { day: string }).day);
        const row = db.prepare(
            'SELECT status FROM day_progress WHERE student_id = ? AND day = ?'
        ).get(req.user.id, day) as { status: string } | undefined;
        if (!row) return reply.code(409).send({ error: 'not_approved' });
        if (row.status === 'complete') return { ok: true };  // 이미 완료 — 멱등 처리
        if (row.status !== 'approved') return reply.code(409).send({ error: 'not_approved' });
        db.prepare(
            "UPDATE day_progress SET status = 'complete', updated_at = ? WHERE student_id = ? AND day = ?"
        ).run(Date.now(), req.user.id, day);
        return { ok: true };
    });

    // DELETE /tasks/:id  (student, todo status only)
    app.delete('/tasks/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const task = db.prepare(
            'SELECT day, status FROM tasks WHERE id = ? AND student_id = ?'
        ).get(id, req.user.id) as { day: number; status: string } | undefined;

        if (!task) return reply.code(404).send({ error: 'not_found' });
        if (task.status !== 'todo' && task.status !== 'plan_rejected') return reply.code(409).send({ error: 'cannot_delete' });

        db.transaction(() => {
            db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
            recalcDayStatus(db, req.user.id, task.day);
        })();
        return { ok: true };
    });
}
