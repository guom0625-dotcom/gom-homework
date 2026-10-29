-- 산책: 숲길 달리기(kind 'run')를 지금 키우는 펫과 한 판 마치면 그날 산책한 날 (2026-10-29 사용자 결정 — 하루 필수 돌봄)
ALTER TABLE pet_days ADD COLUMN walked INTEGER NOT NULL DEFAULT 0;
