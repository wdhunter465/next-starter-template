-- P1-09 / #3382 — F5 takedown/suppress evidence on content_inventory.
-- Port of #2919 F5 columns only into the Club Newspaper lineage.
-- Forward-only. Does NOT reuse compliance migration 0045. No F4/F6 columns.

ALTER TABLE content_inventory ADD COLUMN suppression_reason TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_request_source TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_resolution_note TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_requested_at TEXT;

CREATE INDEX IF NOT EXISTS idx_content_inventory_suppression
  ON content_inventory(status, takedown_requested_at)
  WHERE suppression_reason IS NOT NULL;
