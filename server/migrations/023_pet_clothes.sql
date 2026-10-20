-- 펫 옷: 입고 있는 상의·모자 (pet_items 의 item_key, 예: 'top_tee_red@baby')
ALTER TABLE pets ADD COLUMN wear_top TEXT;
ALTER TABLE pets ADD COLUMN wear_hat TEXT;
