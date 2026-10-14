// 날짜는 KST 기준 YYYYMMDD 정수 (예: 20261012). "오늘"은 서버가 /me 로 알려준다.

export function dayParts(day: number): { y: number; m: number; d: number } {
    return { y: Math.floor(day / 10000), m: Math.floor(day / 100) % 100, d: day % 100 };
}

/** 20261012 → "10월 12일" */
export function formatDay(day: number): string {
    const { m, d } = dayParts(day);
    return `${m}월 ${d}일`;
}

/** 해당 날짜가 속한 달의 모든 날짜 (28~31개) */
export function monthDays(day: number): number[] {
    const { y, m } = dayParts(day);
    const count = new Date(y, m, 0).getDate();
    return Array.from({ length: count }, (_, i) => y * 10000 + m * 100 + i + 1);
}

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

function fromUTC(ms: number): number {
    return Number(new Date(ms).toISOString().slice(0, 10).replace(/-/g, ''));
}

/** 기기 시계 기준 오늘(KST). 목록의 "최근 1주" 범위 계산용 */
export function todayKST(): number {
    return fromUTC(Date.now() + KST_OFFSET_MS);
}

/** 날짜에 n일 더하기 (음수 가능) */
export function addDays(day: number, n: number): number {
    const { y, m, d } = dayParts(day);
    return fromUTC(Date.UTC(y, m - 1, d) + n * DAY_MS);
}

/** 그 날짜 0시(KST)의 시각(ms) */
export function dayStartMs(day: number): number {
    const { y, m, d } = dayParts(day);
    return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

/** 마감시간(그 날 0시로부터 몇 분) → "21:00" / "24:00" / "다음날 06:00" */
export function formatDeadline(min: number): string {
    const nextDay = min > 1440;
    const t = nextDay ? min - 1440 : min;
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    return `${nextDay ? '다음날 ' : ''}${hh}:${mm}`;
}
