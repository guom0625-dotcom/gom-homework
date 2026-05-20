import type { Db } from '../db.ts';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateCode(db: Db, managerId: string): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    // clean up expired codes for this manager
    db.prepare('DELETE FROM pairing_codes WHERE manager_id = ? OR expires_at < ?').run(managerId, now);
    db.prepare(
        'INSERT INTO pairing_codes (code, manager_id, expires_at) VALUES (?, ?, ?)'
    ).run(code, managerId, now + CODE_TTL_MS);
    return code;
}

export function redeemCode(db: Db, code: string, studentId: string): string | null {
    const now = Date.now();
    const row = db.prepare(
        'SELECT manager_id FROM pairing_codes WHERE code = ? AND expires_at > ? AND used_at IS NULL'
    ).get(code, now) as { manager_id: string } | undefined;

    if (!row) return null;

    const tx = db.transaction(() => {
        db.prepare('UPDATE pairing_codes SET used_at = ? WHERE code = ?').run(now, code);
        db.prepare(
            'INSERT OR IGNORE INTO manager_student_link (manager_id, student_id, linked_at) VALUES (?, ?, ?)'
        ).run(row.manager_id, studentId, now);
    });
    tx();
    return row.manager_id;
}
