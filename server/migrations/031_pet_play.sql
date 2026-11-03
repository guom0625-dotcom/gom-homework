-- 놀아주기: 그날 지금 키우는 펫과 뱀 게임(kind snake)을 한 판 시작하면 놀아준 날 (2026-11-03 사용자 결정 — 하루 필수 돌봄, 점수 기준 없음)
ALTER TABLE pet_days ADD COLUMN played INTEGER NOT NULL DEFAULT 0;
