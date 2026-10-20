-- 펫 성장: 알 → 유아 → 청소년 → 성인. 단계마다 조건(연속 일수·방 크기)을 채우면 아이가 성장 버튼을 누른다.
ALTER TABLE pets ADD COLUMN stage TEXT NOT NULL DEFAULT 'egg';   -- egg | baby | teen | adult
ALTER TABLE pets ADD COLUMN stage_day TEXT;                      -- 지금 단계가 시작된 KST 날짜
ALTER TABLE pets ADD COLUMN last_fed_at INTEGER;
UPDATE pets SET stage_day = date(created_at / 1000 + 9 * 3600, 'unixepoch');

-- 날마다 한 일 (연속 일수 계산용)
CREATE TABLE pet_days (
    pet_id      TEXT NOT NULL REFERENCES pets(id),
    student_id  TEXT NOT NULL REFERENCES users(id),
    day         TEXT NOT NULL,
    fed         INTEGER NOT NULL DEFAULT 0,
    patted      INTEGER NOT NULL DEFAULT 0,
    cleaned     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pet_id, day)
);

-- 똥: 밥 먹고 3시간·8시간 뒤에 나온다. 위치 u, v 는 0~1 (방 크기에 맞춰 앱이 펼친다)
CREATE TABLE pet_poops (
    id          TEXT PRIMARY KEY,
    pet_id      TEXT NOT NULL REFERENCES pets(id),
    student_id  TEXT NOT NULL REFERENCES users(id),
    at          INTEGER NOT NULL,
    u           REAL NOT NULL,
    v           REAL NOT NULL,
    cleaned_at  INTEGER
);
CREATE INDEX pet_poops_pet ON pet_poops(pet_id, cleaned_at);

-- 방 크기는 학생 것 (펫이 바뀌어도 남는다). 0 작은 방, 1 중간 방, 2 큰 방
CREATE TABLE pet_home (
    student_id  TEXT PRIMARY KEY REFERENCES users(id),
    room_level  INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL
);
