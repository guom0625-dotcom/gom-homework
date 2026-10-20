-- 펫 털색·무늬 번호 (앱 species.ts 의 looks 순서). 깨어날 때 종류와 함께 정한다
ALTER TABLE pets ADD COLUMN variant INTEGER NOT NULL DEFAULT 0;
