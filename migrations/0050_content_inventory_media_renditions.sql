-- P1-07 / #3419 — additive media rendition metadata (thumbnail/small/medium/large).
-- Forward-only. No drops. No Production apply claimed by this child.

CREATE TABLE IF NOT EXISTS content_inventory_media_renditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('thumbnail', 'small', 'medium', 'large')),
  b2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  width_px INTEGER,
  height_px INTEGER,
  bytes INTEGER,
  content_type TEXT,
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed', 'pending')) DEFAULT 'pending',
  error TEXT,
  generated_at TEXT NOT NULL,
  generated_by TEXT,
  UNIQUE (media_id, size)
);

CREATE INDEX IF NOT EXISTS idx_content_inventory_media_renditions_media_id
  ON content_inventory_media_renditions (media_id);

CREATE INDEX IF NOT EXISTS idx_content_inventory_media_renditions_status
  ON content_inventory_media_renditions (status);
