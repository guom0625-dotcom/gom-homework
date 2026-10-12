-- 보석 5종 → 다이아 1종으로 통일
-- 보상은 할일 단위가 아니라 "하루 할일 전부 승인" 시 다이아 1개 지급 (reason = 'day_complete')
-- 기존 잔고/비용은 종류 구분 없이 개수 합계로 환산

ALTER TABLE gems_balance ADD COLUMN diamond INTEGER NOT NULL DEFAULT 0;
UPDATE gems_balance SET diamond = topaz + emerald + sapphire + ruby + amethyst;
ALTER TABLE gems_balance DROP COLUMN topaz;
ALTER TABLE gems_balance DROP COLUMN emerald;
ALTER TABLE gems_balance DROP COLUMN sapphire;
ALTER TABLE gems_balance DROP COLUMN ruby;
ALTER TABLE gems_balance DROP COLUMN amethyst;

ALTER TABLE reward_catalog ADD COLUMN cost INTEGER NOT NULL DEFAULT 1;
UPDATE reward_catalog SET cost = MAX(1, cost_topaz + cost_emerald + cost_sapphire + cost_ruby + cost_amethyst);
ALTER TABLE reward_catalog DROP COLUMN cost_topaz;
ALTER TABLE reward_catalog DROP COLUMN cost_emerald;
ALTER TABLE reward_catalog DROP COLUMN cost_sapphire;
ALTER TABLE reward_catalog DROP COLUMN cost_ruby;
ALTER TABLE reward_catalog DROP COLUMN cost_amethyst;

-- 할일별 보상 컬럼 제거
ALTER TABLE tasks DROP COLUMN gem_type;
ALTER TABLE tasks DROP COLUMN gem_amount;

-- 사용되지 않던 자동 보상 규칙도 다이아 기준으로
UPDATE auto_reward_rules SET gem_type = 'diamond';
