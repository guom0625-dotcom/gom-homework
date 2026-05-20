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
import { registerSpendRoutes } from './routes/spendRequests.ts';
import { registerStudentRoutes } from './routes/students.ts';

export type AuthHandler = ReturnType<typeof makeAuth>;

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.DB_PATH ?? './data/gom_homework.sqlite3';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const db = openDb(DB_PATH);
const app = Fastify({ logger: { level: LOG_LEVEL } });

app.decorateRequest('user', null as unknown as import('./auth.ts').AuthUser);

const auth = makeAuth(db);

registerAuthRoutes(app, db, auth);
registerMeRoutes(app, db, auth);
registerTaskRoutes(app, db, auth);
registerRulesRoutes(app, db, auth);
registerCatalogRoutes(app, db, auth);
registerSpendRoutes(app, db, auth);
registerStudentRoutes(app, db, auth);

app.get('/health', async () => ({ ok: true, time: Date.now() }));

const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
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
