-- 계획 상신 → 계획 승인 → 완료 상신 → 완료 승인 단계 추가
-- tasks.status CHECK 확장: plan_submitted, plan_approved, plan_rejected 추가

CREATE TABLE tasks_new (
    id           TEXT PRIMARY KEY,
    student_id   TEXT NOT NULL REFERENCES users(id),
    day          INTEGER NOT NULL,
    title        TEXT NOT NULL,
    memo         TEXT,
    status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK(status IN ('todo','plan_submitted','plan_approved','plan_rejected','submitted','approved','rejected')),
    gem_type     TEXT,
    gem_amount   INTEGER,
    submitted_at INTEGER,
    reviewed_at  INTEGER,
    created_at   INTEGER NOT NULL
);

INSERT INTO tasks_new SELECT * FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX idx_tasks_student_day ON tasks(student_id, day);
