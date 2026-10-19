-- 펫 앱(gomTamagotchi)의 펫. 학생마다 지금 키우는 펫(status='active')은 하나뿐이다.
-- 날짜는 KST 'YYYY-MM-DD'. 배부름은 저장하지 않고 last_fed_day 로 읽을 때 계산한다.
CREATE TABLE pets (
    id            TEXT PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES users(id),
    species       TEXT NOT NULL,
    name          TEXT,
    status        TEXT NOT NULL DEFAULT 'active',   -- active | gone | graduated
    fed_days      INTEGER NOT NULL DEFAULT 0,       -- 밥 먹은 날 수 (성장 기준)
    last_fed_day  TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX pets_one_active ON pets(student_id) WHERE status = 'active';
