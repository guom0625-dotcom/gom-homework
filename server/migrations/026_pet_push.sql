-- 펫 앱 알림 기기 (숙제앱 push_tokens 와 따로 — 숙제 알림이 펫 앱으로, 펫 알림이 숙제앱으로 가지 않게)
CREATE TABLE pet_push_tokens (
    token       TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL REFERENCES users(id),
    updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_pet_push_tokens_student ON pet_push_tokens(student_id);
-- 하루 두 번(아침 8시·오후 5시) 알림을 보냈는지 (서버를 다시 켜도 두 번 보내지 않게)
CREATE TABLE pet_notify_log (
    student_id  TEXT NOT NULL,
    day         TEXT NOT NULL,
    slot        TEXT NOT NULL,
    sent_at     INTEGER NOT NULL,
    PRIMARY KEY (student_id, day, slot)
);
