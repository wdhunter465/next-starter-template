-- 0048_content_inventory_events.sql
-- Task 007 (#2055): append-only publication audit for content_inventory writes.
-- Additive; not applied to Production D1 by this slice.
-- Does not mutate pipeline moderation_events (content_items-scoped).

CREATE TABLE IF NOT EXISTS content_inventory_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rollback_group_id TEXT,
  event_at TEXT NOT NULL,
  actor TEXT,
  actor_role TEXT,
  candidate_id TEXT,
  inventory_id INTEGER NOT NULL,
  from_state TEXT,
  to_state TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'stage', 'review', 'approve', 'schedule', 'pause', 'cancel_schedule',
    'publish', 'rotate', 'unpublish', 'rollback', 'archive', 'reject',
    'suppress', 'reopen', 'return_to_draft'
  )),
  reason TEXT,
  schedule_id TEXT,
  publication_target TEXT,
  approval_snapshot TEXT,
  source_snapshot TEXT,
  public_check INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_content_inventory_events_inventory_created
  ON content_inventory_events(inventory_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_inventory_events_action
  ON content_inventory_events(action, event_at DESC);
