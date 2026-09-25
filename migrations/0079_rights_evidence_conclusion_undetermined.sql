-- 0079_rights_evidence_conclusion_undetermined.sql
-- #4374 Q2: widen rights_evidence.conclusion to add 'rights_undetermined' --
-- a genuine "we looked, and it's genuinely unclear" record, distinct from
-- the three existing "yes" conclusions and distinct from no evidence row at
-- all. Written with usage_decision='hold', channel='internal_archive_only'.
-- It must never satisfy content-pipeline-publication-prep.ts's
-- PREP_ACCEPTABLE_RIGHTS_STATUSES allowlist -- see
-- content-pipeline-license-conclusion-mapping.ts's mapConclusionToRightsStatus,
-- which maps it to content_items.rights_status = 'unknown' (already excluded).
--
-- rights_evidence is a leaf table (migration 0059 verified nothing holds an
-- FK to it), so this is the simple rebuild case: no dependents to repoint.
-- Column list is 0065_archive_acquisition_core.sql's rights_evidence_next
-- verbatim, plus the one widened CHECK.

CREATE TABLE rights_evidence_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id),
  search_run_id INTEGER REFERENCES content_search_runs(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'openverse_license', 'loc_statement', 'commons_license', 'dpla_rights_statement',
    'usco_search', 'cmg_grant', 'pre_1931_publication', 'member_ownership', 'other',
    'donor_agreement'
  )),
  evidence_text TEXT,
  evidence_url TEXT,
  evidence_metadata TEXT NOT NULL DEFAULT '{}',
  reviewer TEXT,
  conclusion TEXT CHECK (conclusion IS NULL OR conclusion IN (
    'public_domain_confirmed', 'permission_granted', 'lgfc_member_owned_item_photo',
    'rights_undetermined'
  )),
  conclusion_rationale TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  channel TEXT CHECK (channel IS NULL OR channel IN (
    'website', 'social_media', 'newsletter_email', 'fundraiser_campaign', 'internal_archive_only'
  )),
  rights_holder TEXT,
  repository_or_collection TEXT,
  publication_established INTEGER CHECK (publication_established IS NULL OR publication_established IN (0, 1)),
  us_publication_or_uraa_confirmed INTEGER
    CHECK (us_publication_or_uraa_confirmed IS NULL OR us_publication_or_uraa_confirmed IN (0, 1)),
  publication_date_source TEXT,
  source_filename TEXT,
  tagging_requirements TEXT,
  usage_decision TEXT NOT NULL DEFAULT 'hold'
    CHECK (usage_decision IN ('permit', 'deny', 'hold'))
);
INSERT INTO rights_evidence_next SELECT * FROM rights_evidence;
DROP TABLE rights_evidence;
ALTER TABLE rights_evidence_next RENAME TO rights_evidence;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_content_item
  ON rights_evidence(content_item_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_rights_evidence_conclusion
  ON rights_evidence(conclusion)
  WHERE conclusion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_search_run
  ON rights_evidence(search_run_id)
  WHERE search_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_content_item_channel
  ON rights_evidence(content_item_id, channel, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_rights_evidence_usage_decision
  ON rights_evidence(usage_decision)
  WHERE usage_decision = 'hold';
