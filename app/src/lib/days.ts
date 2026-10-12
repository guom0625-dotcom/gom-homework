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
