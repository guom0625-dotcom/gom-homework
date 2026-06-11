import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPES } from '../lib/gems.ts';

const PatchBody = z.object({
    name: z.string().min(1).max(30).optional(),
    push_token: z.string().max(200).nullable().optional(),
    character: z.enum(['bear', 'fox', 'cat', 'owl']).optional(),
    // base64 data URL — ~500KB cap (300x300 JPEG q0.7 압축 시 ~30~60KB 가정, 여유분 포함)
    avatar: z.string().max(700_000).nullable().optional(),
});

export function registerMeRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    app.get('/me', { preHandler: auth }, async (req) => {
        const user = db.prepare('SELECT id, name, role, push_token, character, avatar FROM users WHERE id = ?')
            .get(req.user.id) as { id: string; name: string; role: string; push_token: string | null; character: string; avatar: string | null };

        const result: Record<string, unknown> = { ...user };

        if (user.role === 'student') {
            const gems = db.prepare('SELECT topaz, emerald, sapphire, ruby, amethyst FROM gems_balance WHERE student_id = ?')
                .get(req.user.id) as Record<string, number> | undefined;
            result.gems = gems ?? null;

            const link = db.prepare(`
                SELECT u.id, u.name FROM manager_student_link l
                JOIN users u ON u.id = l.manager_id
                WHERE l.student_id = ?
            `).get(req.user.id);
            result.manager = link ?? null;
        }

        if (user.role === 'manager') {
            const students = db.prepare(`
                SELECT u.id, u.name FROM manager_student_link l
                JOIN users u ON u.id = l.student_id
                WHERE l.manager_id = ?
            `).all(req.user.id);
            result.students = students;
        }

        return result;
    });

    app.patch('/me', { preHandler: auth }, async (req, reply) => {
        const body = PatchBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const { name, push_token, character, avatar } = body.data;
        if (name !== undefined) {
            db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
        }
        if (push_token !== undefined) {
            db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(push_token, req.user.id);
        }
        if (character !== undefined) {
            db.prepare('UPDATE users SET character = ? WHERE id = ?').run(character, req.user.id);
        }
        if (avatar !== undefined) {
            db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
        }
        return { ok: true };
    });

    // GET /progress  (student — own day progress)
    app.get('/progress', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        return db.prepare(
            'SELECT * FROM day_progress WHERE student_id = ? ORDER BY day ASC'
        ).all(req.user.id);
    });
}
