-- 미니룸: 다이아·루비로 산 가구는 창고에 들어가고, 꺼내서 방에 배치한다
CREATE TABLE room_items (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL REFERENCES users(id),
    item_key    TEXT NOT NULL,             -- 가구 종류 (lib/furniture.ts)
    cost        INTEGER NOT NULL DEFAULT 0, -- 산 가격 (다이아)
    cost_ruby   INTEGER NOT NULL DEFAULT 0, -- 산 가격 (루비)
    placed      INTEGER NOT NULL DEFAULT 0, -- 0 = 창고, 1 = 방에 놓임
    x           INTEGER NOT NULL DEFAULT 0, -- 방 격자 칸 (가구가 차지하는 칸 중 안쪽 모서리)
    z           INTEGER NOT NULL DEFAULT 0,
    rot         INTEGER NOT NULL DEFAULT 2, -- 0~3, 90° 단위 방향
    bought_at   INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_room_items_student ON room_items(student_id);

-- 벽지·바닥 색
CREATE TABLE room_style (
    student_id  TEXT PRIMARY KEY REFERENCES users(id),
    wall        TEXT NOT NULL,
    floor       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);
