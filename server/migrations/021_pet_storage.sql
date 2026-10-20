-- 창고: 산 물건은 창고에 있고, 방 크기만큼 꺼내 놓을 수 있다 (작은 방 2 · 중간 방 4 · 큰 방 6)
ALTER TABLE pet_items ADD COLUMN placed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_items ADD COLUMN placed_at INTEGER;   -- 방에 꺼낸 시각 (능력은 이때부터 작동)
-- 지금까지 산 것은 꺼내 둔 상태로 (자리가 모자라면 앱에서 넣으면 된다)
UPDATE pet_items SET placed = 1, placed_at = created_at WHERE item_key NOT LIKE 'wall_%' AND item_key NOT LIKE 'cushion_%';
ALTER TABLE pets ADD COLUMN robot_day TEXT;          -- 자동 청소기가 마지막으로 치운 날
ALTER TABLE pet_days ADD COLUMN auto_fed INTEGER NOT NULL DEFAULT 0;   -- 자동 급식기가 준 날
