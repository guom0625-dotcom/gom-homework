import { randomInt } from 'node:crypto';
import type { Db } from '../db.ts';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// studentId 가 있으면 그 학생 계정으로 다시 로그인하는 코드, 없으면 새 학생을 연결하는 코드
export function generateCode(db: Db, managerId: string, studentId: string | null = null): string {
    const code = String(randomInt(100000, 1_000_000));
    const now = Date.now();
    // clean up expired codes for this manager
    db.prepare('DELETE FROM pairing_codes WHERE manager_id = ? OR expires_at < ?').run(managerId, now);
    db.prepare(
        'INSERT INTO pairing_codes (code, manager_id, student_id, expires_at) VALUES (?, ?, ?, ?)'
    ).run(code, managerId, studentId, now + CODE_TTL_MS);
    return code;
}

/** 재로그인 코드 확인. 맞으면 사용 처리하고 대상 학생 id 반환 */
export function redeemLoginCode(db: Db, code: string): string | null {
    const now = Date.now();
    const row = db.prepare(`
        SELECT student_id FROM pairing_codes
        WHERE code = ? AND expires_at > ? AND used_at IS NULL AND student_id IS NOT NULL
    `).get(code, now) as { student_id: string } | undefined;
    if (!row) return null;
    db.prepare('UPDATE pairing_codes SET used_at = ? WHERE code = ?').run(now, code);
    return row.student_id;
}

export function redeemCode(db: Db, code: string, studentId: string): string | null {
    const now = Date.now();
    const row = db.prepare(
        'SELECT manager_id FROM pairing_codes WHERE code = ? AND expires_at > ? AND used_at IS NULL AND student_id IS NULL'
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
