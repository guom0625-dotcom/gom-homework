-- 펫 아픔·병원·떠남, 간식, 아이템(장난감·가구), 돌봄 도우미
ALTER TABLE pets ADD COLUMN sick_since INTEGER;              -- 아프기 시작한 시각 (낫으면 NULL)
ALTER TABLE pets ADD COLUMN med_given INTEGER NOT NULL DEFAULT 0;      -- 이번에 아픈 동안 약을 먹었다
ALTER TABLE pets ADD COLUMN hospital_visits INTEGER NOT NULL DEFAULT 0; -- 이번에 아픈 동안 병원에 간 날 수
ALTER TABLE pets ADD COLUMN happy_until INTEGER;             -- 간식으로 기분좋음이 이어지는 시각
ALTER TABLE pets ADD COLUMN helper_day TEXT;                 -- 돌봄 도우미를 마지막으로 쓴 날
ALTER TABLE pets ADD COLUMN gone_at INTEGER;
ALTER TABLE pets ADD COLUMN gone_reason TEXT;                -- hunger | sick

ALTER TABLE pet_days ADD COLUMN snacks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_days ADD COLUMN hospital INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_days ADD COLUMN helped INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pet_home ADD COLUMN wallpaper TEXT;              -- 붙인 벽지 (NULL = 기본)
ALTER TABLE pet_home ADD COLUMN cushion TEXT;                -- 쿠션 색 (NULL = 기본 분홍)

-- 한 번 사면 계속 있는 아이템 (장난감·가구). 펫이 바뀌어도 남는다
CREATE TABLE pet_items (
    student_id  TEXT NOT NULL REFERENCES users(id),
    item_key    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (student_id, item_key)
);
