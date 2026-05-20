import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { GEM_TYPES } from '../lib/gems.ts';

const RuleItem = z.object({
    student_id: z.string(),
    day_streak: z.number().int().positive(),
    gem_type: z.enum(GEM_TYPES),
    gem_amount: z.number().int().positive(),
    active: z.boolean().default(true),
});

const PutBody = z.object({
    rules: z.array(RuleItem),
});

export function registerRulesRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /rules?student_id=xxx
    app.get('/rules', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { student_id } = req.query as { student_id?: string };

        let sql = 'SELECT * FROM auto_reward_rules WHERE manager_id = ?';
        const params: unknown[] = [req.user.id];
        if (student_id) { sql += ' AND student_id = ?'; params.push(student_id); }
        sql += ' ORDER BY student_id, day_streak';

        return db.prepare(sql).all(...params);
    });

    // PUT /rules  (full replace for a student)
    app.put('/rules', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const body = PutBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const now = Date.now();
        const studentIds = [...new Set(body.data.rules.map((r) => r.student_id))];

        const tx = db.transaction(() => {
            for (const sid of studentIds) {
                db.prepare(
                    'DELETE FROM auto_reward_rules WHERE manager_id = ? AND student_id = ?'
                ).run(req.user.id, sid);
            }
            for (const r of body.data.rules) {
                db.prepare(`
                    INSERT INTO auto_reward_rules
                        (manager_id, student_id, day_streak, gem_type, gem_amount, active, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(req.user.id, r.student_id, r.day_streak, r.gem_type, r.gem_amount, r.active ? 1 : 0, now);
            }
        });
        tx();

        return { ok: true };
    });
}
