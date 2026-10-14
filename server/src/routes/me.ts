import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.ts';
import type { AuthHandler } from '../index.ts';
import { currentStreak, monthProgress } from '../lib/gems.ts';
import { todayKST } from '../lib/days.ts';
import { REGISTER_DEADLINE_ENABLED, managerDeadlines, studentDeadlines } from '../lib/deadlines.ts';

const PatchBody = z.object({
    name: z.string().min(1).max(30).optional(),
    // 이 기기의 알림 토큰 등록. null = (예전 앱의 로그아웃) 이 계정의 모든 기기 해제
    push_token: z.string().min(1).max(4096).nullable().optional(),
    // 이 기기만 알림 해제 (로그아웃, 또는 "이 폰에서 알림 받기"를 껐을 때)
    remove_push_token: z.string().min(1).max(4096).optional(),
    character: z.enum(['bear', 'fox', 'cat', 'owl']).optional(),
    // base64 data URL — ~500KB cap (300x300 JPEG q0.7 압축 시 ~30~60KB 가정, 여유분 포함)
    avatar: z.string().max(700_000).nullable().optional(),
});

export function registerMeRoutes(app: FastifyInstance, db: Db, auth: AuthHandler): void {
    app.get('/me', { preHandler: auth }, async (req) => {
        const user = db.prepare('SELECT id, name, role, character, avatar, created_at FROM users WHERE id = ?')
            .get(req.user.id) as { id: string; name: string; role: string; character: string; avatar: string | null; created_at: number };

        const { created_at, ...profile } = user;
        const result: Record<string, unknown> = { ...profile, today: todayKST(), joined_day: todayKST(created_at) };

        // 적용되는 마감시간 (학생은 연결된 매니저의 설정)
        Object.assign(result, user.role === 'manager'
            ? managerDeadlines(db, req.user.id)
            : studentDeadlines(db, req.user.id), { register_deadline_enabled: REGISTER_DEADLINE_ENABLED });

        if (user.role === 'student') {
            const balance = db.prepare('SELECT diamond FROM gems_balance WHERE student_id = ?')
                .get(req.user.id) as { diamond: number } | undefined;
            result.diamonds = balance?.diamond ?? 0;
            result.streak = currentStreak(db, req.user.id);

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

        const { name, push_token, remove_push_token, character, avatar } = body.data;
        if (name !== undefined) {
            db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
        }
        if (push_token === null) {
            db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(req.user.id);
        } else if (push_token !== undefined) {
            // 토큰은 기기 하나를 가리킨다 — 그 폰에서 다른 계정으로 바꿔 로그인하면 새 계정 것으로 옮겨진다
            db.prepare(`
                INSERT INTO push_tokens (token, user_id, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at
            `).run(push_token, req.user.id, Date.now());
        }
        if (remove_push_token !== undefined) {
            db.prepare('DELETE FROM push_tokens WHERE token = ? AND user_id = ?').run(remove_push_token, req.user.id);
        }
        if (character !== undefined) {
            db.prepare('UPDATE users SET character = ? WHERE id = ?').run(character, req.user.id);
        }
        if (avatar !== undefined) {
            db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
        }
        return { ok: true };
    });

    // GET /progress?month=YYYYMM  (student — 해당 월의 날짜별 할일 현황, 기본은 이번 달)
    app.get('/progress', { preHandler: auth }, async (req, reply) => {
        if (req.user.role !== 'student') return reply.code(403).send({ error: 'forbidden' });
        const { month } = req.query as { month?: string };
        return monthProgress(db, req.user.id, Number(month) || Math.floor(todayKST() / 100));
    });
}
