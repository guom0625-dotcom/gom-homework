// 날짜는 KST 기준 YYYYMMDD 정수로 다룬다 (예: 20261012)

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

export function todayKST(now: number = Date.now()): number {
    return Number(new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', ''));
}

function toUTC(day: number): number {
    return Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
}

export function isValidDay(day: number): boolean {
    return Number.isInteger(day) && todayKST(toUTC(day) - KST_OFFSET_MS) === day;
}

export function prevDay(day: number): number {
    return todayKST(toUTC(day) - KST_OFFSET_MS - DAY_MS);
}

export function msUntilNextKSTMidnight(now: number = Date.now()): number {
    return DAY_MS - ((now + KST_OFFSET_MS) % DAY_MS);
}
