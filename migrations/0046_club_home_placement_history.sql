-- 0046_club_home_placement_history.sql
-- P1-04 (#3395): additive Club Home placement-history log.
-- Expand only: new table + indexes. No DROP/cleanup. No backfill required.
-- Design authority: docs/explanation/website/content-strategy.md
--   (asset/zone/timestamp/selection_mode; edition_id and media_rendition reserved nullable for later children)

CREATE TABLE IF NOT EXISTS content_inventory_placement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  zone_id TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT 'club_home',
  placed_at TEXT NOT NULL,
  selection_mode TEXT NOT NULL DEFAULT 'automatic',
  edition_id INTEGER,
  media_rendition TEXT,
  feature_size TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_placement_history_story_placed
  ON content_inventory_placement_history (story_id, placed_at);

CREATE INDEX IF NOT EXISTS idx_placement_history_zone_placed
  ON content_inventory_placement_history (zone_id, placed_at);
