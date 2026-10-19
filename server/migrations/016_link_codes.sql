-- 펫 앱(gomTamagotchi) 연결 코드: 숙제앱이 학생 키로 발급하고, 펫 앱이 딥링크로 받아 같은 계정의 새 키로 바꾼다
-- 코드 원문은 저장하지 않고 sha256 만 둔다. 60초 유효, 한 번만 쓸 수 있다
CREATE TABLE link_codes (
    code_hash   TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL REFERENCES users(id),
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
);
