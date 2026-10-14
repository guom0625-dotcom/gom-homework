import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { sendPushToUser } from '../lib/push.ts';

// 책 한 권을 다 읽고 승인받으면 주는 루비 개수
export const BOOK_REWARD_RUBY = 1;

const CreateBody = z.object({
    title: z.string().min(1).max(100),
    // 책 사진은 필수. 앱에서 줄여서 보내는 JPEG data URL (~수십 KB) — 넉넉히 600KB 까지
    photo: z.string().startsWith('data:image/').max(600_000),
    // 책장용 작은 표지 (선택 — 예전 앱은 보내지 않는다)
    thumb: z.string().startsWith('data:image/').max(100_000).optional(),
});

const ApproveBody = z.object({
    praise: z.string().max(100).optional(),
}).optional();

const FinishBody = z.object({
    summary: z.string().min(1).max(1000),
});

interface BookRow {
    id: string;
    student_id: string;
    title: string;
    status: 'reading' | 'done_requested' | 'done';
}

// 책읽기: 등록(승인 불필요) → 다 읽으면 읽은 내용을 적어 완료 요청 → 매니저 승인 시 루비 지급
export function registerBookRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    const isLinked = (managerId: string, studentId: string): boolean =>
        !!db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(managerId, studentId);

    const managerOf = (studentId: string): string | undefined =>
        (db.prepare('SELECT manager_id FROM manager_student_link WHERE student_id = ?').get(studentId) as
            { manager_id: string } | undefined)?.manager_id;

    const userName = (userId: string): string =>
        (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string }).name;

    const ownBook = (id: string, studentId: string): BookRow | undefined =>
        db.prepare('SELECT id, student_id, title, status FROM books WHERE id = ? AND student_id = ?')
            .get(id, studentId) as BookRow | undefined;

    const reviewableBook = (id: string, managerId: string): BookRow | 'not_found' | 'forbidden' => {
        const book = db.prepare('SELECT id, student_id, title, status FROM books WHERE id = ?').get(id) as
            BookRow | undefined;
        if (!book) return 'not_found';
        return isLinked(managerId, book.student_id) ? book : 'forbidden';
    };

    // GET /books?status=xxx  (student: 내 책 / manager: 연결된 학생들의 책)
    // GET /books?done_since=<ms> → { books, older_done_at }
    //   아직 끝나지 않은 책 전부 + done_since 이후 완료된 책. older_done_at = 그보다 앞선 가장 최근 완료 시각(없으면 null)
    app.get('/books', { preHandler: auth }, async (req) => {
        const { status, done_since } = req.query as { status?: string; done_since?: string };
        const params: unknown[] = [req.user.id];

        const sql = req.user.role === 'student'
            ? 'SELECT b.* FROM books b WHERE b.student_id = ?'
            : `SELECT b.*, u.name AS student_name
               FROM books b
               JOIN users u ON u.id = b.student_id
               JOIN manager_student_link l ON l.student_id = b.student_id
               WHERE l.manager_id = ?`;

        if (done_since) {
            const since = Number(done_since);
            const books = db.prepare(
                `${sql} AND (b.status != 'done' OR b.done_at >= ?) ORDER BY b.created_at DESC`
            ).all(...params, since);
            const older = db.prepare(
                `SELECT MAX(x.done_at) AS done_at FROM (${sql} AND b.status = 'done' AND b.done_at < ?) x`
            ).get(...params, since) as { done_at: number | null };
            return { books, older_done_at: older.done_at };
        }

        if (status) {
            params.push(status);
            return db.prepare(`${sql} AND b.status = ? ORDER BY b.created_at DESC`).all(...params);
        }
        return db.prepare(`${sql} ORDER BY b.created_at DESC`).all(...params);
    });

    // GET /books/shelf?student_id=xxx  (책장 — 다 읽은 책 전부, 작은 표지로)
    app.get('/books/shelf', { preHandler: auth }, async (req, reply) => {
        const { student_id } = req.query as { student_id?: string };
        let targetId = req.user.id;
        if (req.user.role === 'manager') {
            if (!student_id) return reply.code(400).send({ error: 'student_id required' });
            if (!isLinked(req.user.id, student_id)) return reply.code(403).send({ error: 'forbidden' });
            targetId = student_id;
        }
        return db.prepare(`
            SELECT id, title, COALESCE(thumb, photo) AS cover, summary, praise, done_at
            FROM books WHERE student_id = ? AND status = 'done'
            ORDER BY done_at DESC
        `).all(targetId);
    });

    // POST /books  (student only — 언제든 등록, 제목과 사진 필수, 매니저 승인 없음)
    app.post('/books', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const body = CreateBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const id = ulid();
        db.prepare(`
            INSERT INTO books (id, student_id, title, photo, thumb, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'reading', ?)
        `).run(id, req.user.id, body.data.title, body.data.photo, body.data.thumb ?? null, Date.now());

        return reply.code(201).send(db.prepare('SELECT * FROM books WHERE id = ?').get(id));
    });

    // POST /books/:id/finish  (student only — 읽은 내용을 적어 완료 요청: reading → done_requested)
    app.post('/books/:id/finish', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = FinishBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const book = ownBook(id, req.user.id);
        if (!book) return reply.code(404).send({ error: 'not_found' });
        if (book.status !== 'reading') return reply.code(409).send({ error: 'cannot_finish' });

        db.prepare(
            "UPDATE books SET status = 'done_requested', summary = ?, requested_at = ? WHERE id = ?"
        ).run(body.data.summary, Date.now(), id);

        await sendPushToUser(db, managerOf(req.user.id), {
            title: `${userName(req.user.id)}가 책을 다 읽었어요`,
            body: book.title,
            data: { type: 'book_done_requested', book_id: id },
        });

        return db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    });

    // DELETE /books/:id  (student only — 아직 읽는 중인 책만. 잘못 등록했을 때)
    app.delete('/books/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const book = ownBook(id, req.user.id);
        if (!book) return reply.code(404).send({ error: 'not_found' });
        if (book.status !== 'reading') return reply.code(409).send({ error: 'cannot_delete' });

        db.prepare('DELETE FROM books WHERE id = ?').run(id);
        return { ok: true };
    });

    // POST /books/:id/approve  (manager only — 완료 승인 + 루비 지급)
    app.post('/books/:id/approve', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = ApproveBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
        const praise = body.data?.praise?.trim() || null;

        const book = reviewableBook(id, req.user.id);
        if (book === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (book === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (book.status !== 'done_requested') return reply.code(409).send({ error: 'not_done_requested' });

        const now = Date.now();
        db.transaction(() => {
            db.prepare("UPDATE books SET status = 'done', done_at = ?, praise = ? WHERE id = ?").run(now, praise, id);
            db.prepare('UPDATE gems_balance SET ruby = ruby + ?, updated_at = ? WHERE student_id = ?')
                .run(BOOK_REWARD_RUBY, now, book.student_id);
            db.prepare(`
                INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
                VALUES (?, ?, 'ruby', ?, 'book_done', ?, ?)
            `).run(ulid(), book.student_id, BOOK_REWARD_RUBY, id, now);
        })();

        await sendPushToUser(db, book.student_id, {
            title: '책읽기 완료 승인!',
            body: `${praise ? `💬 ${praise} — ` : `"${book.title}" — `}루비 ${BOOK_REWARD_RUBY}개를 받았어요`,
            data: { type: 'book_approved', book_id: id },
        });

        return { ok: true };
    });

    // POST /books/:id/reject  (manager only — 완료 요청 반려: 다시 읽는 중으로)
    app.post('/books/:id/reject', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const book = reviewableBook(id, req.user.id);
        if (book === 'not_found') return reply.code(404).send({ error: 'not_found' });
        if (book === 'forbidden') return reply.code(403).send({ error: 'forbidden' });
        if (book.status !== 'done_requested') return reply.code(409).send({ error: 'not_done_requested' });

        db.prepare("UPDATE books SET status = 'reading', requested_at = NULL WHERE id = ?").run(id);

        await sendPushToUser(db, book.student_id, {
            title: '책읽기를 다시 확인해봐요',
            body: `"${book.title}" — 읽은 내용을 다시 적어서 요청해주세요`,
            data: { type: 'book_rejected', book_id: id },
        });

        return { ok: true };
    });
}
