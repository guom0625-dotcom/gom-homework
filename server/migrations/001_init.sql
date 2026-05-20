-- gom-homework 초기 스키마
-- 모든 시각 컬럼은 unix epoch milliseconds (INTEGER)

CREATE TABLE users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('manager','student')),
    push_token  TEXT,
    created_at  INTEGER NOT NULL,
    revoked_at  INTEGER
);

CREATE TABLE auth_keys (
    key_hash      TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id),
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER,
    revoked_at    INTEGER
);
CREATE INDEX idx_auth_keys_user ON auth_keys(user_id);

-- 매니저-학생 연결 (1 manager : N students)
CREATE TABLE manager_student_link (
    manager_id  TEXT NOT NULL REFERENCES users(id),
    student_id  TEXT NOT NULL REFERENCES users(id),
    linked_at   INTEGER NOT NULL,
    PRIMARY KEY (manager_id, student_id)
);
CREATE INDEX idx_link_student ON manager_student_link(student_id);

-- 페어링 코드 (6자리, 5분 TTL)
CREATE TABLE pairing_codes (
    code        TEXT PRIMARY KEY,
    manager_id  TEXT NOT NULL REFERENCES users(id),
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
);

-- 학생 보석 잔고
CREATE TABLE gems_balance (
    student_id  TEXT PRIMARY KEY REFERENCES users(id),
    topaz       INTEGER NOT NULL DEFAULT 0,
    emerald     INTEGER NOT NULL DEFAULT 0,
    sapphire    INTEGER NOT NULL DEFAULT 0,
    ruby        INTEGER NOT NULL DEFAULT 0,
    amethyst    INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL
);

-- 일일 할일 (student가 등록)
CREATE TABLE tasks (
    id           TEXT PRIMARY KEY,
    student_id   TEXT NOT NULL REFERENCES users(id),
    day          INTEGER NOT NULL,  -- Day 1, 2, 3...
    title        TEXT NOT NULL,
    memo         TEXT,
    status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK(status IN ('todo','submitted','approved','rejected')),
    gem_type     TEXT,              -- reward gem type (NULL until approved)
    gem_amount   INTEGER,
    submitted_at INTEGER,
    reviewed_at  INTEGER,
    created_at   INTEGER NOT NULL
);
CREATE INDEX idx_tasks_student_day ON tasks(student_id, day);

-- 일별 진행 상태
CREATE TABLE day_progress (
    student_id  TEXT NOT NULL REFERENCES users(id),
    day         INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'todo'
                CHECK(status IN ('todo','pending','approved','complete')),
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (student_id, day)
);

-- 자동 보상 규칙 (매니저 설정)
CREATE TABLE auto_reward_rules (
    manager_id      TEXT NOT NULL REFERENCES users(id),
    student_id      TEXT NOT NULL REFERENCES users(id),
    day_streak      INTEGER NOT NULL DEFAULT 1,  -- N일 연속 완료시
    gem_type        TEXT NOT NULL,
    gem_amount      INTEGER NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    updated_at      INTEGER NOT NULL,
    PRIMARY KEY (manager_id, student_id, day_streak)
);

-- 보상 카탈로그 (매니저가 등록)
CREATE TABLE reward_catalog (
    id          TEXT PRIMARY KEY,
    manager_id  TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    description TEXT,
    cost_topaz     INTEGER NOT NULL DEFAULT 0,
    cost_emerald   INTEGER NOT NULL DEFAULT 0,
    cost_sapphire  INTEGER NOT NULL DEFAULT 0,
    cost_ruby      INTEGER NOT NULL DEFAULT 0,
    cost_amethyst  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
);
CREATE INDEX idx_catalog_manager ON reward_catalog(manager_id);

-- 보상 구매 요청 (student → manager)
CREATE TABLE spend_requests (
    id           TEXT PRIMARY KEY,
    student_id   TEXT NOT NULL REFERENCES users(id),
    catalog_id   TEXT NOT NULL REFERENCES reward_catalog(id),
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','approved','rejected')),
    reviewed_at  INTEGER,
    created_at   INTEGER NOT NULL
);
CREATE INDEX idx_spend_student ON spend_requests(student_id);
CREATE INDEX idx_spend_status  ON spend_requests(status);

-- 보석 변동 로그
CREATE TABLE gem_transactions (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL REFERENCES users(id),
    gem_type    TEXT NOT NULL,
    delta       INTEGER NOT NULL,  -- positive: earn, negative: spend
    reason      TEXT NOT NULL,     -- 'task_approve', 'spend_approve', 'auto_reward', 'admin'
    ref_id      TEXT,              -- task_id / spend_request_id / rule key
    created_at  INTEGER NOT NULL
);
CREATE INDEX idx_gem_tx_student ON gem_transactions(student_id, created_at DESC);
