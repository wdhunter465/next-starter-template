-- 0070_editorial_audit.sql
-- P1-08 (#3416): additive structured editorial audit trail.
-- Expand only: new table + indexes. No DROP/cleanup. No backfill required.
-- Design: per-action audit beyond free-form review_notes for review/publish/inventory.
-- Failure policy (packaged): audit insert is fail-open so missing table does not
-- block authorized editorial mutations; only successful mutations write rows.

CREATE TABLE IF NOT EXISTS editorial_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id INTEGER,
  actor TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  before_json TEXT,
  after_json TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_editorial_audit_action_created
  ON editorial_audit_events (action, created_at);

CREATE INDEX IF NOT EXISTS idx_editorial_audit_object_created
  ON editorial_audit_events (object_type, object_id, created_at);
