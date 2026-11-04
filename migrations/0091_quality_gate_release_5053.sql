-- #5053 (slice 1b of #5037, follows #5038): record the quality-gate verdict and the release for
-- edition use on each collected item.
--
-- Product Authority direction (2026-10-31, #5038): collected content that passes the quality gate
-- may be used in editions (website and social) before written permission arrives; the copyright
-- check is paused for editions and posts. The release is a record of that direction, not a person's
-- rights release, and it never touches media_assets.rights_hold: a rights hold still decides what
-- the public website shows through the daily B2 sync. Editions read released_for_editions_at.
--
--   gate_decision            good | needs_review | not_good (NULL = not evaluated yet)
--   gate_relevance           gehrig-primary | gehrig-linked | manual-keep | excluded
--   gate_reasons             comma-separated reason codes from functions/_lib/content-quality-gate.ts
--   gate_evaluated_at        when the gate last ran on this row
--   gate_manual_keep         1 = Product Authority said keep this although its text does not name Gehrig
--   released_for_editions_at set only for gate_decision = 'good'
--   release_basis            the direction the release rests on
--
-- Reverse every release made under this direction with one statement:
--   UPDATE content_items
--      SET released_for_editions_at = NULL, release_basis = NULL
--    WHERE release_basis LIKE 'Product Authority direction 2026-10-31%';
--
-- No backfill here: the archive ingest evaluates new items, and its --evaluate-archived mode
-- evaluates the pictures already archived (dry run by default).

ALTER TABLE content_items ADD COLUMN gate_decision TEXT
  CHECK (gate_decision IS NULL OR gate_decision IN ('good', 'needs_review', 'not_good'));
ALTER TABLE content_items ADD COLUMN gate_relevance TEXT
  CHECK (gate_relevance IS NULL OR gate_relevance IN ('gehrig-primary', 'gehrig-linked', 'manual-keep', 'excluded'));
ALTER TABLE content_items ADD COLUMN gate_reasons TEXT;
ALTER TABLE content_items ADD COLUMN gate_evaluated_at TEXT;
ALTER TABLE content_items ADD COLUMN gate_manual_keep INTEGER NOT NULL DEFAULT 0
  CHECK (gate_manual_keep IN (0, 1));
ALTER TABLE content_items ADD COLUMN released_for_editions_at TEXT;
ALTER TABLE content_items ADD COLUMN release_basis TEXT;

CREATE INDEX IF NOT EXISTS idx_content_items_released_for_editions
  ON content_items (released_for_editions_at)
  WHERE released_for_editions_at IS NOT NULL;
