-- 0048_club_home_editions.sql
-- P1-06 (#3413): additive Club Home persisted editions + active pointer.
-- Expand only: new tables + indexes. No DROP/cleanup. No backfill required.
-- D4 (Product Authority + WORK on #3382, 2026-08-13):
--   D1-authoritative immutable editions; one explicit active edition;
--   on-demand regenerate; explicit rollback; no extra cache/provider layer.

CREATE TABLE IF NOT EXISTS content_inventory_club_home_editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  completed_at TEXT,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_club_home_editions_status_created
  ON content_inventory_club_home_editions (status, created_at);

-- At most one in-flight building edition (deterministic concurrency fail-closed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_home_editions_one_building
  ON content_inventory_club_home_editions (status)
  WHERE status = 'building';

CREATE TABLE IF NOT EXISTS content_inventory_club_home_edition_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL,
  zone_id TEXT NOT NULL,
  story_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  selection_mode TEXT NOT NULL DEFAULT 'automatic',
  feature_size TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_club_home_edition_placements_edition
  ON content_inventory_club_home_edition_placements (edition_id, zone_id, position);

CREATE TABLE IF NOT EXISTS content_inventory_club_home_active_edition (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  edition_id INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  activated_by TEXT
);
