-- 0095_club_home_edition_archive_5076.sql
-- #5076 step 1: record when each Club Home edition was live, and what each placement showed.
--
-- Product Authority direction (2026-11-03/04): archive and recall what was published on a specific
-- date and time. Today the active pointer is overwritten on every activation, so "which edition was
-- live at time T" cannot be answered, and a placement points at rows whose text, picture and rights
-- state can change afterwards.
--
--   club_home_edition_activations  append-only log: one row per activation or rollback, UTC.
--   placement snapshot columns     filled when the edition is built, never changed afterwards.
--
-- Additive only. Existing editions keep NULL snapshot columns (nothing before this migration can be
-- recovered). One backfill row records the edition that is live now, so its window starts here.
-- Step 2 (recall endpoint), step 3 (purge guard) and step 4 (cadence) are separate changes.
--
-- Triggers: the log cannot be updated or deleted. A placement cannot be updated. A placement of an
-- edition that appears in the log cannot be deleted. Editions that were never activated through the
-- log (for example the pilot seed in seed-club-home-pilot.yml, which rewrites its own placements
-- directly) are not affected.
--
-- Reverse this migration with:
--   DROP TRIGGER trg_club_home_activations_no_update;
--   DROP TRIGGER trg_club_home_activations_no_delete;
--   DROP TRIGGER trg_club_home_placements_no_update;
--   DROP TRIGGER trg_club_home_placements_no_delete_logged;
--   DROP TABLE club_home_edition_activations;
--   (the placement snapshot columns stay; SQLite cannot drop a column without a rebuild, and they are harmless)

CREATE TABLE IF NOT EXISTS club_home_edition_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  activated_by TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('regenerate', 'rollback', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_club_home_edition_activations_at
  ON club_home_edition_activations (activated_at, id);

CREATE INDEX IF NOT EXISTS idx_club_home_edition_activations_edition
  ON club_home_edition_activations (edition_id);

ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_taken_at TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_title TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_text_sha256 TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_credit_line TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_source_name TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_media_id INTEGER;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_media_url TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_media_rendition TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_rights_status TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_final_status TEXT;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_rights_hold INTEGER;
ALTER TABLE content_inventory_club_home_edition_placements ADD COLUMN snapshot_publication_eligible INTEGER;

CREATE TRIGGER IF NOT EXISTS trg_club_home_activations_no_update
BEFORE UPDATE ON club_home_edition_activations
BEGIN
  SELECT RAISE(ABORT, 'club_home_edition_activations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_club_home_activations_no_delete
BEFORE DELETE ON club_home_edition_activations
BEGIN
  SELECT RAISE(ABORT, 'club_home_edition_activations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_club_home_placements_no_update
BEFORE UPDATE ON content_inventory_club_home_edition_placements
BEGIN
  SELECT RAISE(ABORT, 'club home edition placements are not updated after they are written');
END;

CREATE TRIGGER IF NOT EXISTS trg_club_home_placements_no_delete_logged
BEFORE DELETE ON content_inventory_club_home_edition_placements
WHEN EXISTS (SELECT 1 FROM club_home_edition_activations WHERE edition_id = OLD.edition_id)
BEGIN
  SELECT RAISE(ABORT, 'placements of an activated edition are kept');
END;

-- The edition that is live now gets one log row, dated from its own activation time.
INSERT INTO club_home_edition_activations (edition_id, activated_at, activated_by, reason)
SELECT edition_id, activated_at, COALESCE(activated_by, 'unknown'), 'manual'
  FROM content_inventory_club_home_active_edition
 WHERE singleton = 1;
