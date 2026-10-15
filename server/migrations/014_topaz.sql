-- 토파즈: 미니룸 가구 전용 보석. 다이아 1 → 토파즈 10 으로 바꿀 수 있다 (반대는 불가)
-- 기본값 50 — 지금 학생들과 앞으로 가입하는 학생 모두 토파즈 50개로 시작
ALTER TABLE gems_balance ADD COLUMN topaz INTEGER NOT NULL DEFAULT 50;
INSERT INTO gem_transactions (id, student_id, gem_type, delta, reason, ref_id, created_at)
    SELECT lower(hex(randomblob(16))), student_id, 'topaz', 50, 'topaz_start', NULL,
           CAST(strftime('%s', 'now') AS INTEGER) * 1000
    FROM gems_balance;

-- 가구를 산 가격 (토파즈). 예전 cost/cost_ruby 는 다이아·루비로 샀던 기록
ALTER TABLE room_items ADD COLUMN cost_topaz INTEGER NOT NULL DEFAULT 0;
