-- 누가 치웠는지: NULL = 아이, 'robot' = 자동 청소기 (앱이 청소기 움직임을 보여 준다)
ALTER TABLE pet_poops ADD COLUMN cleaned_by TEXT;
