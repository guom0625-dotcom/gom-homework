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

/** 날짜에 n일 더하기 (음수 가능) */
export function addDays(day: number, n: number): number {
    return todayKST(toUTC(day) - KST_OFFSET_MS + n * DAY_MS);
}

/** 그 날짜가 속한 주의 월요일 */
export function weekStartOf(day: number): number {
    const dow = new Date(toUTC(day)).getUTCDay();  // 0 = 일요일
    return addDays(day, -((dow + 6) % 7));
}
