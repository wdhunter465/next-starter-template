-- 0053_rights_hold_quarantine.sql
-- #3552: existing-content quarantine. Per Bill's explicit direction, all content
-- currently in D1/B2 is presumed not legal to use until a full per-item rights
-- review occurs and Bill grants explicit permission. This migration makes that
-- presumption binding at the data layer: every row already in `photos` and
-- `media_assets` is marked held, and the column default keeps any future row
-- held until a reviewer explicitly clears it. No rows are deleted here.

PRAGMA foreign_keys = ON;

ALTER TABLE photos ADD COLUMN rights_hold INTEGER NOT NULL DEFAULT 1 CHECK (rights_hold IN (0, 1));
ALTER TABLE photos ADD COLUMN rights_hold_reason TEXT;
ALTER TABLE photos ADD COLUMN rights_hold_set_at TEXT;

UPDATE photos
SET rights_hold = 1,
    rights_hold_reason = 'legacy_content_pending_rights_review_2026_08_17',
    rights_hold_set_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE rights_hold_reason IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_rights_hold ON photos(rights_hold);

ALTER TABLE media_assets ADD COLUMN rights_hold INTEGER NOT NULL DEFAULT 1 CHECK (rights_hold IN (0, 1));
ALTER TABLE media_assets ADD COLUMN rights_hold_reason TEXT;
ALTER TABLE media_assets ADD COLUMN rights_hold_set_at TEXT;

UPDATE media_assets
SET rights_hold = 1,
    rights_hold_reason = 'legacy_content_pending_rights_review_2026_08_17',
    rights_hold_set_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE rights_hold_reason IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_rights_hold ON media_assets(rights_hold);
