-- 졸업한 시각 (도감 순서). 졸업한 펫은 status 'graduated' 로 남는다
ALTER TABLE pets ADD COLUMN graduated_at INTEGER;
