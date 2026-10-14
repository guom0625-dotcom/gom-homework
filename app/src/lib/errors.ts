// 서버 오류 코드 → 학생에게 보여줄 문구
const MESSAGES: Record<string, string> = {
    register_closed: '오늘 할일 등록 시간이 지났어요. 마감 전에 하나라도 등록해 둬야 나중에 추가할 수 있어요',
    day_passed: '완료 마감 시간이 지났어요',
    not_today: '오늘 날짜에만 등록할 수 있어요',
};

export function errorMessage(e: unknown, fallback: string): string {
    const code = e instanceof Error ? e.message : '';
    return MESSAGES[code] ?? (code || fallback);
}
