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
import { registerSettingsRoutes } from './routes/settings.ts';
import { registerBookRoutes } from './routes/books.ts';
import { DAY_REWARD, settlePastDays } from './lib/gems.ts';
import { todayKST } from './lib/days.ts';
import { sendPushToUser } from './lib/push.ts';

export type AuthHandler = ReturnType<typeof makeAuth>;

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.DB_PATH ?? './data/gom_homework.sqlite3';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const db = openDb(DB_PATH);
const app = Fastify({ logger: { level: LOG_LEVEL } });

app.decorateRequest('user', null as unknown as import('./auth.ts').AuthUser);

const auth = makeAuth(db);

// 하루 보상 정산: 완료 마감시간(매니저 설정)이 지난 날 중 할일이 전부 승인된 날에 다이아 지급.
// 서버가 폰에서 돌아 기기가 절전에 들어가면 타이머가 멈추므로 "정해진 시각에 한 번 울리는 타이머"는 믿을 수 없다.
// 대신 1분마다, 그리고 요청이 들어올 때(최대 1분에 한 번) 벽시계 기준으로 마감이 지났는지 확인한다.
const SETTLE_INTERVAL_MS = 60_000;
const SETTLE_LOOKBACK_DAYS = 3;  // 주기 확인은 최근 며칠만. 그보다 오래 밀린 건 서버 시작 때 전체 훑기로 처리
let lastSettleAt = 0;
const settle = (full = false) => {
    const now = Date.now();
    if (!full && now - lastSettleAt < SETTLE_INTERVAL_MS) return;
    lastSettleAt = now;
    try {
        const rewarded = settlePastDays(db, full ? 0 : todayKST(now - SETTLE_LOOKBACK_DAYS * 86_400_000));
        if (rewarded.length > 0) app.log.info({ rewarded }, 'day rewards settled');
        for (const { studentId } of rewarded) {
            void sendPushToUser(db, studentId, {
                title: '할일 모두 완료!',
                body: `다이아 ${DAY_REWARD}개를 받았어요 💎`,
                data: { type: 'day_rewarded' },
            });
        }
    } catch (err) {
        app.log.error(err, 'day settlement failed');
    }
};
settle(true);
const settleTimer = setInterval(() => settle(), SETTLE_INTERVAL_MS);
app.addHook('onRequest', async () => { settle(); });

registerAuthRoutes(app, db, auth);
registerMeRoutes(app, db, auth);
registerTaskRoutes(app, db, auth);
registerRulesRoutes(app, db, auth);
registerCatalogRoutes(app, db, auth);
registerRewardRoutes(app, db, auth);
registerStudentRoutes(app, db, auth);
registerSettingsRoutes(app, db, auth);
registerBookRoutes(app, db, auth);

// app: 앱이 집 WiFi에서 내부 주소가 진짜 이 서버인지 확인하는 데 쓴다
app.get('/health', async () => ({ ok: true, app: 'gom-homework', time: Date.now() }));

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
