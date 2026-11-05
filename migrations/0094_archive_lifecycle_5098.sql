-- 0094_archive_lifecycle_5098.sql
-- #5098 (child of #5086): archive lifecycle states, an event log, a permanent tombstone and the
-- sweep's database side.
--
-- Product Authority direction (2026-11-05): record management is done by the ingestion and
-- evaluation tools, or by a GitHub Issue that flags records, never by hand-editing rows; a sweep then
-- removes what has been identified for deletion from D1 and B2.
--
--   active          every existing row; the only state selection and publishing read
--   not_to_be_used  retired: reversible, hidden from selection, kept in D1 and B2
--   ok_to_delete    approved for removal; delete_after ends the waiting period
--   purged          terminal: the B2 object and the picture row are gone, the record stays
--
-- Legal moves only (enforced by triggers): active <-> not_to_be_used; not_to_be_used -> ok_to_delete;
-- ok_to_delete -> not_to_be_used (cancel) or purged (after delete_after). Every move needs a new reason.
-- Every move writes a row to archive_lifecycle_events. Purged items leave a row in archive_tombstones,
-- so collection can skip them later.
--
-- Nothing changes for visitors: every existing row is 'active', and the only changed object is the
-- active_content_items view, which now also requires lifecycle_state = 'active'.
--
-- Reverse this migration with:
--   DROP TRIGGER trg_content_items_lifecycle_legal_move;  (and the four other trg_content_items_lifecycle_* triggers)
--   DROP TABLE archive_tombstones; DROP TABLE archive_lifecycle_events;
--   re-create active_content_items without the lifecycle filter;
--   the six content_items columns stay (SQLite cannot drop a column without a rebuild) and are harmless.

PRAGMA foreign_keys = ON;

ALTER TABLE content_items ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle_state IN ('active', 'not_to_be_used', 'ok_to_delete', 'purged'));
ALTER TABLE content_items ADD COLUMN lifecycle_reason TEXT;
ALTER TABLE content_items ADD COLUMN lifecycle_set_at TEXT;
ALTER TABLE content_items ADD COLUMN lifecycle_set_by TEXT;
ALTER TABLE content_items ADD COLUMN lifecycle_issue INTEGER;
ALTER TABLE content_items ADD COLUMN delete_after TEXT;

CREATE INDEX IF NOT EXISTS idx_content_items_lifecycle_state
  ON content_items (lifecycle_state) WHERE lifecycle_state <> 'active';

CREATE TABLE IF NOT EXISTS archive_lifecycle_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  actor TEXT,
  issue_number INTEGER,
  delete_after TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_archive_lifecycle_events_item
  ON archive_lifecycle_events (content_item_id, id);

CREATE TABLE IF NOT EXISTS archive_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL UNIQUE,
  candidate_id TEXT,
  source_url TEXT,
  source_domain TEXT,
  title TEXT,
  b2_key TEXT,
  media_uid TEXT,
  reason TEXT,
  flagged_by TEXT,
  flagged_issue INTEGER,
  flagged_at TEXT,
  purged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sweep_run TEXT
);

CREATE INDEX IF NOT EXISTS idx_archive_tombstones_source_url
  ON archive_tombstones (source_url) WHERE source_url IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_archive_lifecycle_events_no_update
BEFORE UPDATE ON archive_lifecycle_events
BEGIN SELECT RAISE(ABORT, 'archive_lifecycle_events is append-only'); END;

CREATE TRIGGER IF NOT EXISTS trg_archive_lifecycle_events_no_delete
BEFORE DELETE ON archive_lifecycle_events
BEGIN SELECT RAISE(ABORT, 'archive_lifecycle_events is append-only'); END;

CREATE TRIGGER IF NOT EXISTS trg_archive_tombstones_no_update
BEFORE UPDATE ON archive_tombstones
BEGIN SELECT RAISE(ABORT, 'archive_tombstones is append-only'); END;

CREATE TRIGGER IF NOT EXISTS trg_archive_tombstones_no_delete
BEFORE DELETE ON archive_tombstones
BEGIN SELECT RAISE(ABORT, 'archive_tombstones is append-only'); END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_lifecycle_legal_move
BEFORE UPDATE OF lifecycle_state ON content_items
WHEN NEW.lifecycle_state IS NOT OLD.lifecycle_state
 AND NOT ((OLD.lifecycle_state = 'active' AND NEW.lifecycle_state = 'not_to_be_used')
       OR (OLD.lifecycle_state = 'not_to_be_used' AND NEW.lifecycle_state IN ('active', 'ok_to_delete'))
       OR (OLD.lifecycle_state = 'ok_to_delete' AND NEW.lifecycle_state IN ('not_to_be_used', 'purged')))
BEGIN
  SELECT RAISE(ABORT, 'illegal lifecycle move: active, not_to_be_used, ok_to_delete, purged only move one legal step at a time');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_lifecycle_needs_reason
BEFORE UPDATE OF lifecycle_state ON content_items
WHEN NEW.lifecycle_state IS NOT OLD.lifecycle_state
 AND (NEW.lifecycle_reason IS NULL OR trim(NEW.lifecycle_reason) = '' OR NEW.lifecycle_reason IS OLD.lifecycle_reason)
BEGIN
  SELECT RAISE(ABORT, 'a lifecycle move needs a new reason');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_lifecycle_delete_after
BEFORE UPDATE OF lifecycle_state ON content_items
WHEN NEW.lifecycle_state = 'ok_to_delete' AND NEW.delete_after IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ok_to_delete needs delete_after, the end of the waiting period');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_lifecycle_waiting_period
BEFORE UPDATE OF lifecycle_state ON content_items
WHEN NEW.lifecycle_state = 'purged' AND OLD.lifecycle_state = 'ok_to_delete'
 AND (OLD.delete_after IS NULL OR OLD.delete_after > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
BEGIN
  SELECT RAISE(ABORT, 'purged needs the waiting period to have passed (delete_after)');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_lifecycle_event
AFTER UPDATE OF lifecycle_state ON content_items
WHEN NEW.lifecycle_state IS NOT OLD.lifecycle_state
BEGIN
  INSERT INTO archive_lifecycle_events (content_item_id, from_state, to_state, reason, actor, issue_number, delete_after)
  VALUES (NEW.id, OLD.lifecycle_state, NEW.lifecycle_state, NEW.lifecycle_reason, NEW.lifecycle_set_by, NEW.lifecycle_issue, NEW.delete_after);
END;

-- Selection and publishing read this view: only active records are returned.
DROP VIEW IF EXISTS active_content_items;
CREATE VIEW active_content_items AS
  SELECT * FROM content_items WHERE superseded_at IS NULL AND lifecycle_state = 'active';
