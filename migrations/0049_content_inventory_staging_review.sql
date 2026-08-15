-- 0049_content_inventory_staging_review.sql
-- Task 007 (#2055): persist staging-review metadata on content_inventory.
-- Additive; not applied to Production D1 by this slice.

ALTER TABLE content_inventory ADD COLUMN rights_status TEXT;
ALTER TABLE content_inventory ADD COLUMN privacy_flag TEXT;
ALTER TABLE content_inventory ADD COLUMN reviewer TEXT;
ALTER TABLE content_inventory ADD COLUMN reviewed_at TEXT;
ALTER TABLE content_inventory ADD COLUMN rejection_reason TEXT;
