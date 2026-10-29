-- 산책: 그날 지금 키우는 펫과 달린 숲길 달리기(kind run) 점수 합이 5000 이상이면 산책한 날 (2026-10-29 사용자 결정 — 하루 필수 돌봄)
ALTER TABLE pet_days ADD COLUMN walked INTEGER NOT NULL DEFAULT 0;
