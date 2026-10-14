import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';

const ItemBody = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).nullable().optional(),
    // 가격: 다이아(cost)와 루비(cost_ruby)를 섞을 수 있다. 둘 중 하나는 1 이상
    cost: z.number().int().min(0),
    cost_ruby: z.number().int().min(0).optional(),
    // once = 1회성(한 번 팔리면 상점에서 사라짐), always = 상시
    kind: z.enum(['once', 'always']).optional(),
});

export function registerCatalogRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // GET /catalog  (student sees manager's catalog; manager sees own)
    app.get('/catalog', { preHandler: auth }, async (req, reply) => {
        let managerId: string;
        if (req.user.role === 'manager') {
            managerId = req.user.id;
        } else {
            const link = db.prepare(`
                SELECT manager_id FROM manager_student_link WHERE student_id = ?
            `).get(req.user.id) as { manager_id: string } | undefined;
            if (!link) return reply.code(404).send({ error: 'not_linked' });
            managerId = link.manager_id;
        }
        return db.prepare(
            'SELECT * FROM reward_catalog WHERE manager_id = ? AND active = 1 ORDER BY created_at ASC'
        ).all(managerId);
    });

    // POST /catalog  (manager only)
    app.post('/catalog', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const body = ItemBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const costRuby = body.data.cost_ruby ?? 0;
        if (body.data.cost + costRuby < 1) return reply.code(400).send({ error: 'invalid_body' });

        const id = ulid();
        const now = Date.now();
        db.prepare(`
            INSERT INTO reward_catalog
                (id, manager_id, title, description, cost, cost_ruby, kind, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
            id, req.user.id, body.data.title, body.data.description ?? null,
            body.data.cost, costRuby, body.data.kind ?? 'always', now
        );

        return reply.code(201).send(db.prepare('SELECT * FROM reward_catalog WHERE id = ?').get(id));
    });

    // PATCH /catalog/:id  (manager only)
    app.patch('/catalog/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const body = ItemBody.partial().safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const item = db.prepare(
            'SELECT id, cost, cost_ruby FROM reward_catalog WHERE id = ? AND manager_id = ?'
        ).get(id, req.user.id) as { id: string; cost: number; cost_ruby: number } | undefined;
        if (!item) return reply.code(404).send({ error: 'not_found' });
        if ((body.data.cost ?? item.cost) + (body.data.cost_ruby ?? item.cost_ruby) < 1) {
            return reply.code(400).send({ error: 'invalid_body' });
        }

        const fields = Object.entries(body.data)
            .map(([k]) => `${k} = ?`)
            .join(', ');
        if (!fields) return { ok: true };

        db.prepare(`UPDATE reward_catalog SET ${fields} WHERE id = ?`)
            .run(...Object.values(body.data), id);
        return db.prepare('SELECT * FROM reward_catalog WHERE id = ?').get(id);
    });

    // DELETE /catalog/:id  (soft delete, manager only)
    app.delete('/catalog/:id', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };

        const item = db.prepare(
            'SELECT id FROM reward_catalog WHERE id = ? AND manager_id = ?'
        ).get(id, req.user.id);
        if (!item) return reply.code(404).send({ error: 'not_found' });

        db.prepare('UPDATE reward_catalog SET active = 0 WHERE id = ?').run(id);
        return { ok: true };
    });
}
