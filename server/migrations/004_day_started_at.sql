ALTER TABLE day_progress ADD COLUMN started_at INTEGER;
UPDATE day_progress SET started_at = updated_at WHERE started_at IS NULL;
