-- 미니미 캐릭터: 옷차림(JSON)과 방 안 위치. 옷은 토파즈로 한 번 사면 계속 입을 수 있다
ALTER TABLE room_style ADD COLUMN avatar     TEXT;     -- {"body","skin","hair","top","topColor",...}
ALTER TABLE room_style ADD COLUMN avatar_x   INTEGER;  -- NULL = 아직 방에 놓은 적 없음 (가운데)
ALTER TABLE room_style ADD COLUMN avatar_z   INTEGER;
ALTER TABLE room_style ADD COLUMN avatar_rot INTEGER NOT NULL DEFAULT 2;

CREATE TABLE owned_wear (
    student_id  TEXT NOT NULL REFERENCES users(id),
    item_key    TEXT NOT NULL,            -- lib/wear.ts
    cost_topaz  INTEGER NOT NULL,
    bought_at   INTEGER NOT NULL,
    PRIMARY KEY (student_id, item_key)
);
