-- 보상을 "요청 → 매니저 승인"에서 "상점에서 구매 → 보유 → 사용 요청 → 매니저 사용 완료"로 전환
--  · reward_catalog.kind: 'once' = 1회성(한 번 팔리면 상점에서 사라짐), 'always' = 상시(계속 구매 가능)
--  · owned_rewards: 학생이 구매해 보유 중인 보상. 제목/설명/가격은 구매 시점 값을 그대로 보관

ALTER TABLE reward_catalog ADD COLUMN kind TEXT NOT NULL DEFAULT 'always'
    CHECK(kind IN ('once', 'always'));

CREATE TABLE owned_rewards (
    id               TEXT PRIMARY KEY,
    student_id       TEXT NOT NULL REFERENCES users(id),
    catalog_id       TEXT NOT NULL REFERENCES reward_catalog(id),
    title            TEXT NOT NULL,
    description      TEXT,
    cost             INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'owned'
                     CHECK(status IN ('owned', 'use_requested', 'used')),
    purchased_at     INTEGER NOT NULL,
    use_requested_at INTEGER,
    used_at          INTEGER
);
CREATE INDEX idx_owned_student ON owned_rewards(student_id, purchased_at DESC);
CREATE INDEX idx_owned_status  ON owned_rewards(status);

-- 예전 방식에서 이미 승인(다이아 차감)된 요청은 보유 보상으로 옮긴다. 대기/거절 건은 차감이 없었으므로 버린다.
INSERT INTO owned_rewards (id, student_id, catalog_id, title, description, cost, status, purchased_at)
SELECT sr.id, sr.student_id, sr.catalog_id, rc.title, rc.description, rc.cost, 'owned',
       COALESCE(sr.reviewed_at, sr.created_at)
FROM spend_requests sr
JOIN reward_catalog rc ON rc.id = sr.catalog_id
WHERE sr.status = 'approved';

DROP TABLE spend_requests;
