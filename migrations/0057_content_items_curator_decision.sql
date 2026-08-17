-- 0057_content_items_curator_decision.sql
-- #3552: adds LGFC's own curatorial decision on a discovered content_item,
-- kept deliberately separate from rights_evidence (the immutable, as-found
-- copyright evidence table built in migration 0055) and from the deeper
-- rights_status/review_status/publication_status pipeline state machine.
-- curator_decision is a simple front-line triage field: does LGFC want to
-- use this specific item at all, independent of whether it's legally clear.

PRAGMA foreign_keys = ON;

ALTER TABLE content_items ADD COLUMN curator_decision TEXT NOT NULL DEFAULT 'pending'
  CHECK (curator_decision IN ('pending', 'approved', 'disapproved', 'delete'));

ALTER TABLE content_items ADD COLUMN curator_decision_by TEXT;

ALTER TABLE content_items ADD COLUMN curator_decision_at TEXT;

ALTER TABLE content_items ADD COLUMN curator_decision_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_content_items_curator_decision
  ON content_items(curator_decision, curator_decision_at DESC)
  WHERE deleted_at IS NULL;
