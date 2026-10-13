-- 학생 재로그인 코드: 매니저가 "이미 있는 학생 계정"으로 다시 들어갈 6자리 코드를 발급
-- pairing_codes.student_id 가 있으면 새 학생 연결용이 아니라 그 학생의 재로그인용 코드
ALTER TABLE pairing_codes ADD COLUMN student_id TEXT REFERENCES users(id);
