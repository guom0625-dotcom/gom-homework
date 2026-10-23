-- 펫 미니게임(똥피하기) 기록. 한 판 = 한 줄. 시작할 때 만들고 끝날 때 점수(버틴 ms)를 채운다
CREATE TABLE pet_games (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL,
    pet_id      TEXT NOT NULL,          -- 지금 키우는 펫 또는 도감(졸업)의 펫
    species     TEXT NOT NULL,
    variant     INTEGER NOT NULL,
    stage       TEXT NOT NULL,
    build       TEXT NOT NULL,
    day         TEXT NOT NULL,          -- 한국 날짜 (하루 판수 제한)
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    score_ms    INTEGER
);
CREATE INDEX idx_pet_games_student_day ON pet_games(student_id, day);
CREATE INDEX idx_pet_games_score ON pet_games(score_ms);
