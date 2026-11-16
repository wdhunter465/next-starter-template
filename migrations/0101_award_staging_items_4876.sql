-- 0101_award_staging_items_4876.sql
-- #4876 (child of #2078): private staging storage for Adam Wilson award drafts. Admin-only; nothing reads it
-- from a public route. It is separate from content_blocks (fundraiser) and content_items (archive).
--
--   award_staging_items   one row per draft purpose, criteria, honoree entry or free draft.
--
-- status is 'draft' or 'reviewed' only. There is deliberately no 'published' value: the CHECK makes a
-- published row impossible. Public publication needs the repository owner's express approval on #2078 and a
-- separate Issue. honoree_consent is informational and never read by public code.
--
-- Additive only. Reverse with:
--   DROP TABLE award_staging_items;

CREATE TABLE IF NOT EXISTS award_staging_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('purpose', 'criteria', 'honoree_entry', 'draft')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body_md TEXT NOT NULL DEFAULT '' CHECK (length(body_md) <= 20000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed')),
  honoree_consent TEXT NOT NULL DEFAULT 'unknown'
    CHECK (honoree_consent IN ('unknown', 'requested', 'given', 'declined')),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_award_staging_items_kind_updated
  ON award_staging_items (kind, updated_at DESC);
