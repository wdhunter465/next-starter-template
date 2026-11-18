-- 0102_social_ledger_handed_off_5289.sql
-- #5289 (design docs/reference/operations/social-post-audit-design.md; Production Go recorded on #5289, 2026-11-17).
--
--   1. social_post_ledger.status gains 'handed_off'. For Facebook, Instagram and Pinterest the job only opens a
--      hand-off Issue; the platform is not read back, so the row must not say 'posted'. X keeps 'posted'.
--      SQLite cannot alter a CHECK constraint, so the table is rebuilt: every existing row is copied as is
--      (status, platform_post_id, attempts, error, recorded_at). Rows already 'posted' stay 'posted'; nothing
--      is rewritten.
--   2. social_post_evidence: one row per evidence record version (queue or ad hoc post), for queries and reports.
--      The records themselves are the JSON documents built by scripts/ops/social-evidence.mjs.
--
-- Rollback: take a D1 export first. To reverse, set every 'handed_off' row to 'posted', rebuild the ledger with
-- the old CHECK (posted, failed) and DROP TABLE social_post_evidence. Holds no member data.

CREATE TABLE social_post_ledger_5289 (
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','facebook','instagram','pinterest')),
  status TEXT NOT NULL CHECK (status IN ('posted','failed','handed_off')),
  platform_post_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, platform)
);

INSERT INTO social_post_ledger_5289 (post_id, platform, status, platform_post_id, attempts, error, recorded_at)
SELECT post_id, platform, status, platform_post_id, attempts, error, recorded_at FROM social_post_ledger;

DROP TABLE social_post_ledger;

ALTER TABLE social_post_ledger_5289 RENAME TO social_post_ledger;

CREATE TABLE IF NOT EXISTS social_post_evidence (
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','facebook','instagram','pinterest')),
  version INTEGER NOT NULL CHECK (version >= 1),
  origin TEXT NOT NULL CHECK (origin IN ('queue','ad_hoc')),
  status TEXT NOT NULL CHECK (status IN ('handed_off','confirmed','failed','missing','not_eligible')),
  record_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, platform, version)
);

CREATE INDEX IF NOT EXISTS idx_social_post_evidence_recorded_at ON social_post_evidence (recorded_at);
