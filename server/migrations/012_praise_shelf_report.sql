-- 칭찬 한마디 · 책장 썸네일 · 주간 리포트
ALTER TABLE tasks ADD COLUMN praise TEXT;  -- 매니저가 완료 승인할 때 남긴 칭찬
ALTER TABLE books ADD COLUMN praise TEXT;  -- 매니저가 책읽기 완료 승인할 때 남긴 칭찬
ALTER TABLE books ADD COLUMN thumb  TEXT;  -- 책장용 작은 표지 (없으면 photo 를 쓴다)

-- 주간 리포트를 어느 주까지 보냈는지 (매주 일요일 저녁, 매니저마다 한 번)
CREATE TABLE weekly_report_log (
    manager_id  TEXT NOT NULL REFERENCES users(id),
    week_start  INTEGER NOT NULL,  -- 그 주 월요일 YYYYMMDD
    sent_at     INTEGER NOT NULL,
    PRIMARY KEY (manager_id, week_start)
);
