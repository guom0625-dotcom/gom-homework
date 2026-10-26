-- 미니게임 종류: poop 똥피하기 / run 얼음길 달리기. 순위는 종류마다 따로, 판수는 같이 쓴다.
-- score = 순위에 쓰는 점수 (똥피하기는 버틴 ms, 달리기는 거리 + 물고기). score_ms 는 실제로 논 시간
ALTER TABLE pet_games ADD COLUMN kind TEXT NOT NULL DEFAULT 'poop';
ALTER TABLE pet_games ADD COLUMN score INTEGER;
UPDATE pet_games SET score = score_ms WHERE score_ms IS NOT NULL;
CREATE INDEX idx_pet_games_kind_score ON pet_games(kind, score);
