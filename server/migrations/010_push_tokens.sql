-- 알림을 받는 기기를 계정당 여러 대로: 같은 계정으로 로그인한 폰마다 토큰을 따로 보관
-- (예전에는 users.push_token 하나라서 나중에 켠 폰이 앞의 폰을 밀어냈다)
CREATE TABLE push_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

INSERT INTO push_tokens (token, user_id, updated_at)
SELECT push_token, id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM users WHERE push_token IS NOT NULL;

UPDATE users SET push_token = NULL;
