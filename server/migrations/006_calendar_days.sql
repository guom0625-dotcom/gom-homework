-- "Day N" 순번 → 달력 날짜(KST, YYYYMMDD 정수)로 전환
--  · tasks.day: 해당 순번 day가 시작된 날짜로 환산 (없으면 할일 등록일)
--  · tasks.status: 'delete_requested' 추가 (삭제도 매니저 승인 필요), prev_status = 삭제 요청 전 상태
--  · 하루 보상은 날짜가 바뀐 뒤 서버가 자동 정산 → day_progress 불필요

CREATE TABLE tasks_new (
    id           TEXT PRIMARY KEY,
    student_id   TEXT NOT NULL REFERENCES users(id),
    day          INTEGER NOT NULL,  -- KST 날짜 YYYYMMDD
    title        TEXT NOT NULL,
    memo         TEXT,
    status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK(status IN ('todo','plan_submitted','plan_approved','plan_rejected',
                                  'submitted','approved','rejected','delete_requested')),
    prev_status  TEXT,
    submitted_at INTEGER,
    reviewed_at  INTEGER,
    created_at   INTEGER NOT NULL
);

INSERT INTO tasks_new (id, student_id, day, title, memo, status, submitted_at, reviewed_at, created_at)
SELECT t.id, t.student_id,
       CAST(strftime('%Y%m%d', COALESCE(
           (SELECT dp.started_at FROM day_progress dp WHERE dp.student_id = t.student_id AND dp.day = t.day),
           t.created_at
       ) / 1000, 'unixepoch', '+9 hours') AS INTEGER),
       t.title, t.memo, t.status, t.submitted_at, t.reviewed_at, t.created_at
FROM tasks t;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX idx_tasks_student_day ON tasks(student_id, day);

DROP TABLE day_progress;

-- 이미 지난 날짜는 정산 완료로 표시(지급 0) → 전환 직후 과거분이 한꺼번에 지급되지 않도록
INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
SELECT lower(hex(randomblob(13))), student_id, 'diamond', 0, 'day_complete', CAST(day AS TEXT),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM tasks
WHERE day < CAST(strftime('%Y%m%d', 'now', '+9 hours') AS INTEGER)
GROUP BY student_id, day;
