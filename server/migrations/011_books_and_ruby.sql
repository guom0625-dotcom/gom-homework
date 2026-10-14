-- 책읽기 + 루비
--  · 루비: 책 한 권을 다 읽고 매니저 승인을 받으면 1개. 다이아(하루 할일 보상)와 별개의 보석
--  · 보상 가격은 다이아와 루비를 섞어서 정할 수 있다 (cost = 다이아 개수, cost_ruby = 루비 개수, 둘 중 하나 이상 1 이상)
--  · books: 날짜와 무관하게 언제든 등록 (제목 + 사진 필수, 매니저 승인 없이 등록)
--      reading → (학생이 읽은 내용을 적어 완료 요청) done_requested → (매니저 승인) done / (반려) reading

ALTER TABLE gems_balance   ADD COLUMN ruby      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reward_catalog ADD COLUMN cost_ruby INTEGER NOT NULL DEFAULT 0;
ALTER TABLE owned_rewards  ADD COLUMN cost_ruby INTEGER NOT NULL DEFAULT 0;

CREATE TABLE books (
    id            TEXT PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES users(id),
    title         TEXT NOT NULL,
    photo         TEXT NOT NULL,   -- 책 사진 (JPEG data URL)
    status        TEXT NOT NULL DEFAULT 'reading'
                  CHECK(status IN ('reading', 'done_requested', 'done')),
    summary       TEXT,            -- 완료 요청 때 학생이 적는 읽은 내용
    created_at    INTEGER NOT NULL,
    requested_at  INTEGER,
    done_at       INTEGER
);
CREATE INDEX idx_books_student ON books(student_id, created_at DESC);
CREATE INDEX idx_books_status  ON books(status);
