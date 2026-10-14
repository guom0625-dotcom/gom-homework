import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { hashKey } from '../auth.ts';
import { generateCode, redeemCode, redeemLoginCode } from '../lib/pairing.ts';

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

// /auth/recover 는 로그인 없이 6자리 코드만으로 호출되므로, 틀린 시도가 몰리면 잠시 막는다
const RECOVER_WINDOW_MS = 10 * 60_000;
const RECOVER_MAX_FAILURES = 20;
let recoverFailures: number[] = [];

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

    // POST /students/:id/login-code  (manager only — 로그아웃했거나 폰을 바꾼 학생이 원래 계정으로 다시 들어갈 코드)
    app.post('/students/:id/login-code', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'manager') return reply.code(403).send({ error: 'forbidden' });
        const { id } = req.params as { id: string };
        const link = db.prepare(
            'SELECT 1 FROM manager_student_link WHERE manager_id = ? AND student_id = ?'
        ).get(req.user.id, id);
        if (!link) return reply.code(403).send({ error: 'forbidden' });

        const code = generateCode(db, req.user.id, id);
        return { code, expires_in_seconds: 300 };
    });

    // POST /auth/recover  (로그인 전 — 재로그인 코드로 기존 학생 계정의 새 키 발급)
    app.post('/auth/recover', async (req, reply) => {
        const now = Date.now();
        recoverFailures = recoverFailures.filter((t) => now - t < RECOVER_WINDOW_MS);
        if (recoverFailures.length >= RECOVER_MAX_FAILURES) {
            return reply.code(429).send({ error: 'too_many_attempts' });
        }

        const body = RedeemBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

        const result = db.transaction(() => {
            const studentId = redeemLoginCode(db, body.data.code);
            if (!studentId) return null;
            const user = db.prepare(
                'SELECT id, name, role FROM users WHERE id = ? AND revoked_at IS NULL'
            ).get(studentId) as { id: string; name: string; role: string } | undefined;
            if (!user) return null;

            // 예전 기기의 키는 무효화 — 잃어버린 폰으로는 더 이상 들어올 수 없다
            db.prepare(
                'UPDATE auth_keys SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
            ).run(now, user.id);
            db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(user.id);
            const key = makeKey();
            db.prepare(
                'INSERT INTO auth_keys (key_hash, user_id, created_at) VALUES (?, ?, ?)'
            ).run(hashKey(key), user.id, now);
            return { ...user, key };
        })();

        if (!result) {
            recoverFailures.push(now);
            return reply.code(400).send({ error: 'invalid_or_expired_code' });
        }
        return result;
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
