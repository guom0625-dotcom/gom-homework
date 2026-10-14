import type { Db } from '../db.ts';
import { todayKST } from './days.ts';

// 마감시간은 "그 날짜의 0시(KST)로부터 몇 분 뒤"로 표현한다
export interface Deadlines {
    register_deadline_min: number;  // 새 할일 등록 마감 (당일 안)
    complete_deadline_min: number;  // 완료 상신 마감 = 다이아 지급 시각 (다음날 정오까지 가능)
}

export const DEFAULT_DEADLINES: Deadlines = { register_deadline_min: 1440, complete_deadline_min: 1800 };
export const MAX_REGISTER_MIN = 1440;
export const MAX_COMPLETE_MIN = 2160;

const KST_OFFSET_MS = 9 * 3_600_000;

/** 그 날짜 0시(KST)의 시각(ms) */
export function dayStartMs(day: number): number {
    return Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) - KST_OFFSET_MS;
}

export function managerDeadlines(db: Db, managerId: string): Deadlines {
    const row = db.prepare(
        'SELECT register_deadline_min, complete_deadline_min FROM manager_settings WHERE manager_id = ?'
    ).get(managerId) as Deadlines | undefined;
    return row ?? DEFAULT_DEADLINES;
}

/** 학생에게 적용되는 마감시간 (연결된 매니저의 설정, 없으면 기본값) */
export function studentDeadlines(db: Db, studentId: string): Deadlines {
    const row = db.prepare(`
        SELECT s.register_deadline_min, s.complete_deadline_min
        FROM manager_student_link l
        JOIN manager_settings s ON s.manager_id = l.manager_id
        WHERE l.student_id = ?
    `).get(studentId) as Deadlines | undefined;
    return row ?? DEFAULT_DEADLINES;
}

/**
 * 지금 이 날짜에 새 할일을 등록할 수 있는가.
 * 등록 마감은 "그날 하나도 등록하지 않은 경우"에만 걸린다 — 마감 전에 하나라도 등록해 뒀으면(hasTasks)
 * 그 뒤에도 완료 마감 전까지는 계속 추가할 수 있다.
 */
export function canRegister(d: Deadlines, day: number, hasTasks: boolean, now: number = Date.now()): boolean {
    if (day !== todayKST(now) || isDayClosed(d, day, now)) return false;
    return hasTasks || now < dayStartMs(day) + d.register_deadline_min * 60_000;
}

/** 이 날짜의 완료 마감(=지급 시각)이 지났는가 */
export function isDayClosed(d: Deadlines, day: number, now: number = Date.now()): boolean {
    return now >= dayStartMs(day) + d.complete_deadline_min * 60_000;
}
