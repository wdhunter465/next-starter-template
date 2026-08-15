-- 0047_content_inventory_schedule.sql
-- Task 007 (#2055): persist first_publish schedule clock fields. Additive; not applied to Production D1 by this slice.

ALTER TABLE content_inventory ADD COLUMN scheduled_at TEXT;
ALTER TABLE content_inventory ADD COLUMN schedule_paused INTEGER;
ALTER TABLE content_inventory ADD COLUMN pause_reason TEXT;
