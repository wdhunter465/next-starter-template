-- 0055_rights_evidence_and_search_runs.sql
-- #3551 / #3552: additive schema for the allowlisted Gehrig content-collection
-- design. Purely additive -- no existing table, column, or CHECK constraint is
-- altered. `content_items` (migration 0042) remains the candidate record for
-- discovered material (its `input_stream = 'scheduled_discovery'` value was
-- already reserved for exactly this); its existing `rights_status` enum keeps
-- serving the broader candidate pipeline unchanged.
--
-- `rights_evidence` captures per-source evidence separately from LGFC's
-- reviewed conclusion (#3551's core safety rule: "Preserve source- and
-- aggregator-supplied rights/license text verbatim as evidence, separately
-- from LGFC's conclusion"). `conclusion` uses #3551's exact three-value
-- vocabulary and is NULL until a human reviewer records one -- nothing in
-- this schema can set it automatically.
--
-- `content_search_runs` tracks discovery batches through the seven terminal
-- states #3551 defines, plus `running` while in flight, with a lease/
-- heartbeat expiry so a run can never stay `running` indefinitely.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_search_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_uid TEXT NOT NULL UNIQUE,
  source_id INTEGER REFERENCES sources(id),
  query TEXT,
  filters TEXT NOT NULL DEFAULT '{}',
  result_limit INTEGER,
  page_limit INTEGER,
  adapter_version TEXT,
  initiated_by TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'completed_with_limit', 'no_results',
    'source_error', 'rate_limited', 'cancelled', 'blocked_policy'
  )),
  discovered_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  deferred_count INTEGER NOT NULL DEFAULT 0,
  rights_cleared_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  lease_expires_at TEXT,
  heartbeat_at TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_content_search_runs_status
  ON content_search_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_search_runs_source
  ON content_search_runs(source_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_search_runs_lease
  ON content_search_runs(status, lease_expires_at)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS rights_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id),
  search_run_id INTEGER REFERENCES content_search_runs(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'openverse_license', 'loc_statement', 'commons_license', 'dpla_rights_statement',
    'usco_search', 'cmg_grant', 'pre_1931_publication', 'member_ownership', 'other'
  )),
  evidence_text TEXT,
  evidence_url TEXT,
  evidence_metadata TEXT NOT NULL DEFAULT '{}',
  reviewer TEXT,
  conclusion TEXT CHECK (conclusion IS NULL OR conclusion IN (
    'public_domain_confirmed', 'permission_granted', 'lgfc_member_owned_item_photo'
  )),
  conclusion_rationale TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_rights_evidence_content_item
  ON rights_evidence(content_item_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_rights_evidence_conclusion
  ON rights_evidence(conclusion)
  WHERE conclusion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_search_run
  ON rights_evidence(search_run_id)
  WHERE search_run_id IS NOT NULL;

-- #3551's six approved sources. Idempotent: relies on the unique index
-- on sources(source_domain) from migration 0042. `source_trust_status`
-- reflects that USCO/CMG are human-run, not automated discovery adapters.
INSERT INTO sources (source_domain, source_name, source_type, source_trust_status, source_citation)
VALUES
  ('loc.gov', 'Library of Congress', 'library', 'trusted', 'Library of Congress digital collections and catalog'),
  ('commons.wikimedia.org', 'Wikimedia Commons', 'archive', 'trusted', 'Wikimedia Commons licensed/public-domain media repository'),
  ('openverse.org', 'Openverse', 'other', 'trusted', 'Openverse open-license/public-domain media search aggregator'),
  ('dp.la', 'Digital Public Library of America', 'institution', 'trusted', 'DPLA aggregated US library/museum/archive collections'),
  ('copyright.gov', 'U.S. Copyright Office', 'institution', 'trusted', 'Copyright Public Records System; human-run verification only'),
  ('cmgworldwide.com', 'CMG Worldwide', 'operator', 'trusted', 'Estate-controlled Gehrig rights/licensing relationship; not a bulk source')
ON CONFLICT(source_domain) WHERE source_domain IS NOT NULL AND trim(source_domain) != '' DO NOTHING;
