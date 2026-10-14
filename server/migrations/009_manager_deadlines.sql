-- 매니저가 정하는 마감시간 (연결된 모든 학생에게 공통 적용)
-- 값은 "그 날짜의 0시(KST)로부터 몇 분 뒤"인지.
--   register_deadline_min : 새 할일 등록 마감 (당일 안, 최대 1440 = 24:00)
--   complete_deadline_min : 완료 상신 마감이자 다이아 지급 시각 (다음날 정오까지, 최대 2160)
-- 기본값은 등록 24:00 / 완료 다음날 06:00
CREATE TABLE manager_settings (
    manager_id            TEXT PRIMARY KEY REFERENCES users(id),
    register_deadline_min INTEGER NOT NULL DEFAULT 1440,
    complete_deadline_min INTEGER NOT NULL DEFAULT 1800,
    updated_at            INTEGER NOT NULL
);
