import 'dotenv/config';
import os from 'node:os';
// proot/Termux: uv_interface_addresses syscall is blocked; patch before Fastify logs server address
const _ni = os.networkInterfaces.bind(os);
os.networkInterfaces = () => { try { return _ni(); } catch { return {}; } };

import Fastify from 'fastify';
import { openDb } from './db.ts';
import { makeAuth } from './auth.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerMeRoutes } from './routes/me.ts';
import { registerTaskRoutes } from './routes/tasks.ts';
import { registerRulesRoutes } from './routes/rules.ts';
import { registerCatalogRoutes } from './routes/catalog.ts';
import { registerRewardRoutes } from './routes/rewards.ts';
import { registerStudentRoutes } from './routes/students.ts';
import { DAY_REWARD, settlePastDays } from './lib/gems.ts';
import { todayKST } from './lib/days.ts';
import { sendPush } from './lib/push.ts';

export type AuthHandler = ReturnType<typeof makeAuth>;

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.DB_PATH ?? './data/gom_homework.sqlite3';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const db = openDb(DB_PATH);
const app = Fastify({ logger: { level: LOG_LEVEL } });

app.decorateRequest('user', null as unknown as import('./auth.ts').AuthUser);

const auth = makeAuth(db);

// 하루 보상 정산: 전날 할일이 전부 승인된 학생에게 다이아 지급.
// 서버가 폰에서 돌아 기기가 절전에 들어가면 타이머가 멈추므로 "자정에 한 번 울리는 타이머"는 믿을 수 없다.
// 대신 날짜(KST)가 바뀌었는지를 짧은 주기와 모든 요청에서 벽시계 기준으로 확인해, 바뀌었으면 그때 정산한다.
let settledDay = 0;
const settleIfDayChanged = () => {
    const today = todayKST();
    if (today === settledDay) return;
    try {
        const rewarded = settlePastDays(db);
        settledDay = today;
        if (rewarded.length > 0) app.log.info({ rewarded }, 'day rewards settled');
        for (const { studentId } of rewarded) {
            const student = db.prepare('SELECT push_token FROM users WHERE id = ?').get(studentId) as
                { push_token: string | null } | undefined;
            void sendPush(student?.push_token, {
                title: '할일 모두 완료!',
                body: `다이아 ${DAY_REWARD}개를 받았어요 💎`,
                data: { type: 'day_rewarded' },
            });
        }
    } catch (err) {
        app.log.error(err, 'day settlement failed');
    }
};
settleIfDayChanged();
const settleTimer = setInterval(settleIfDayChanged, 60_000);
app.addHook('onRequest', async () => { settleIfDayChanged(); });

registerAuthRoutes(app, db, auth);
registerMeRoutes(app, db, auth);
registerTaskRoutes(app, db, auth);
registerRulesRoutes(app, db, auth);
registerCatalogRoutes(app, db, auth);
registerRewardRoutes(app, db, auth);
registerStudentRoutes(app, db, auth);

app.get('/health', async () => ({ ok: true, time: Date.now() }));

const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    clearInterval(settleTimer);
    await app.close();
    db.close();
    process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
    await app.listen({ port: PORT, host: HOST });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
