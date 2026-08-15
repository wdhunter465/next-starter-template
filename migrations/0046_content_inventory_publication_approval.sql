-- 0046_content_inventory_publication_approval.sql
-- Task 007 (#2055): persist operational approval fields for fail-closed editorial publish.

ALTER TABLE content_inventory ADD COLUMN operational_state TEXT;
ALTER TABLE content_inventory ADD COLUMN approved_by TEXT;
ALTER TABLE content_inventory ADD COLUMN approved_at TEXT;
ALTER TABLE content_inventory ADD COLUMN publication_reason TEXT;
