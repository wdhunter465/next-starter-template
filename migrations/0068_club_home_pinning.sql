-- 0068_club_home_pinning.sql
-- P1-05 (#3399): additive Club Home manual pin table.
-- Expand only: new table + indexes. No DROP/cleanup. No backfill required.
-- Design authority: docs/explanation/website/content-strategy.md
--   (admin-settable pin per zone; release must not corrupt rotation history)
-- Duration: expires_at NULL means until explicit unpin (operator undo).
--   Default TTL is not locked by repository authority; null-until-unpin is the
--   packaged undo path. Optional expires_at may be set by the pin API.

CREATE TABLE IF NOT EXISTS content_inventory_club_home_pins (
  zone_id TEXT PRIMARY KEY,
  story_id INTEGER NOT NULL,
  pinned_at TEXT NOT NULL,
  pinned_by TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_club_home_pins_story
  ON content_inventory_club_home_pins (story_id);

CREATE INDEX IF NOT EXISTS idx_club_home_pins_expires
  ON content_inventory_club_home_pins (expires_at);
