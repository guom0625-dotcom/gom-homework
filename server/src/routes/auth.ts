import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { hashKey } from '../auth.ts';
import { generateCode, redeemCode } from '../lib/pairing.ts';

const SignupBody = z.object({
    name: z.string().min(1).max(30),
    role: z.enum(['manager', 'student']),
});

const RedeemBody = z.object({
    code: z.string().length(6),
});

function makeKey(): string {
    return randomBytes(32).toString('hex');
}

export function registerAuthRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    // POST /auth/signup
    app.post('/auth/signup', async (req, reply) => {
        const body = SignupBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const { name, role } = body.data;
        const id = ulid();
        const key = makeKey();
        const now = Date.now();

        const tx = db.transaction(() => {
            db.prepare(
                'INSERT INTO users (id, name, role, created_at) VALUES (?, ?, ?, ?)'
            ).run(id, name, role, now);
            db.prepare(
                'INSERT INTO auth_keys (key_hash, user_id, created_at) VALUES (?, ?, ?)'
            ).run(hashKey(key), id, now);
            if (role === 'student') {
                db.prepare(
                    'INSERT INTO gems_balance (student_id, updated_at) VALUES (?, ?)'
                ).run(id, now);
            }
        });
        tx();

        return reply.code(201).send({ id, name, role, key });
    });

    // POST /auth/pairing-code  (manager only)
    app.post('/auth/pairing-code', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const code = generateCode(db, req.user.id);
        return { code, expires_in_seconds: 300 };
    });

    // POST /auth/redeem  (student only)
    app.post('/auth/redeem', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const body = RedeemBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const managerId = redeemCode(db, body.data.code, req.user.id);
        if (!managerId) return reply.code(400).send({ error: 'invalid_or_expired_code' });

        const manager = db.prepare('SELECT id, name FROM users WHERE id = ?').get(managerId) as
            { id: string; name: string } | undefined;
        return { manager };
    });
}
