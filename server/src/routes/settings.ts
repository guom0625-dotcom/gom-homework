import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { MAX_COMPLETE_MIN, MAX_REGISTER_MIN, managerDeadlines } from '../lib/deadlines.ts';

const SettingsBody = z.object({
    register_deadline_min: z.number().int().min(1).max(MAX_REGISTER_MIN),
    complete_deadline_min: z.number().int().min(1).max(MAX_COMPLETE_MIN),
}).refine((v) => v.register_deadline_min <= v.complete_deadline_min);

// 매니저 설정: 할일 등록 마감 / 완료 마감(=다이아 지급) 시각
export function registerSettingsRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /settings  (manager only)
    app.get('/settings', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        return managerDeadlines(db, req.user.id);
    });

    // PUT /settings  (manager only)
    app.put('/settings', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const body = SettingsBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        db.prepare(`
            INSERT INTO manager_settings (manager_id, register_deadline_min, complete_deadline_min, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(manager_id) DO UPDATE SET
                register_deadline_min = excluded.register_deadline_min,
                complete_deadline_min = excluded.complete_deadline_min,
                updated_at = excluded.updated_at
        `).run(req.user.id, body.data.register_deadline_min, body.data.complete_deadline_min, Date.now());

        return managerDeadlines(db, req.user.id);
    });
}
