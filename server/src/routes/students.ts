import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';

export function registerStudentRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /students  (manager only — list linked students with gem balance + current day progress)
    app.get('/students', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });

        const students = db.prepare(`
            SELECT u.id, u.name, u.push_token,
                   gb.topaz, gb.emerald, gb.sapphire, gb.ruby, gb.amethyst,
                   gb.updated_at AS gems_updated_at
            FROM manager_student_link l
            JOIN users u ON u.id = l.student_id
            LEFT JOIN gems_balance gb ON gb.student_id = u.id
            WHERE l.manager_id = ?
            ORDER BY u.name
        `).all(req.user.id);

        return students;
    });

    // GET /students/:id/progress  (manager: specific student day progress)
    app.get('/students/:id/progress', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        return db.prepare(
            'SELECT * FROM day_progress WHERE student_id = ? ORDER BY day ASC'
        ).all(id);
    });
}
