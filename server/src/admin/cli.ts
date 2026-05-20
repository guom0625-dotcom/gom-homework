// Simple admin CLI — run with: npm run admin <command> [args]
// Commands:
//   create-manager <name>   — create a manager account and print the Bearer key
//   list-users              — print all users
//   revoke <user_id>        — revoke a user

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { openDb } from '../db.ts';
import { hashKey } from '../auth.ts';

const DB_PATH = process.env.DB_PATH ?? './data/gom_homework.sqlite3';
const db = openDb(DB_PATH);

const [, , cmd, ...args] = process.argv;

if (cmd === 'create-manager') {
    const name = args[0];
    if (!name) { console.error('Usage: admin create-manager <name>'); process.exit(1); }
    const id = ulid();
    const key = randomBytes(32).toString('hex');
    const now = Date.now();
    db.prepare('INSERT INTO users (id, name, role, created_at) VALUES (?, ?, \'manager\', ?)').run(id, name, now);
    db.prepare('INSERT INTO auth_keys (key_hash, user_id, created_at) VALUES (?, ?, ?)').run(hashKey(key), id, now);
    console.log(`Created manager: ${id}\nName: ${name}\nBearer key: ${key}`);

} else if (cmd === 'list-users') {
    const rows = db.prepare('SELECT id, name, role, created_at, revoked_at FROM users ORDER BY created_at').all();
    console.table(rows);

} else if (cmd === 'revoke') {
    const userId = args[0];
    if (!userId) { console.error('Usage: admin revoke <user_id>'); process.exit(1); }
    db.prepare('UPDATE users SET revoked_at = ? WHERE id = ?').run(Date.now(), userId);
    db.prepare('UPDATE auth_keys SET revoked_at = ? WHERE user_id = ?').run(Date.now(), userId);
    console.log(`Revoked ${userId}`);

} else {
    console.log('Commands: create-manager <name> | list-users | revoke <user_id>');
    process.exit(1);
}

db.close();
