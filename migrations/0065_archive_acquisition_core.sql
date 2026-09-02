-- 0065_archive_acquisition_core.sql
-- #2073 Work Package item 3 (#4060), decisions recorded on #4059
-- (2026-09-02): schema for LGFC's physical archive-acquisition program
-- (donation/loan intake, custody tracking, donor consent).
--
-- Design, per #4059's recorded decisions and the reuse guidance in
-- docs/reference/content/content-rights-runtime-as-built-2073.md:
--   1. An archive item is anchored to a `content_items` row (like every
--      other intake stream: public_research, member_submission, admin_seed,
--      scheduled_discovery) rather than inventing a parallel identity
--      system. This gets archive intake the entire existing apparatus for
--      free -- rights_evidence, moderation_events, publication_candidates,
--      tags, audit trail, soft-delete/retention -- with zero new code
--      duplicating any of it. `input_stream = 'physical_acquisition'` is
--      the new value identifying this stream.
--   2. Rights consent for a donated/loaned item is captured as a new
--      `rights_evidence.evidence_type = 'donor_agreement'` row, per #4059
--      decision 3 -- reusing the same append-only, channel-scoped,
--      usage_decision-triaged table #3551 already built rather than a
--      separate consent mechanism.
--   3. `archive_items` (new, this migration) holds exactly what's genuinely
--      new ground per the as-built doc: custody type/state, donor identity
--      and privacy (name/contact kept separate from the public credit
--      line, matching #4059 decision 4), and storage location -- D1
--      metadata only, per #4059 decision 5.
--   4. `archive_item_custody_events` (new, this migration) is the
--      append-only custody-state audit trail, matching this repo's
--      established `*_events`/`*_audit_events` convention.
--
-- ============================================================================
-- Why this rebuilds content_items and rights_evidence (not just ADD COLUMN)
-- ============================================================================
-- Widening a CHECK constraint (content_items.input_stream to add
-- 'physical_acquisition'; rights_evidence.evidence_type to add
-- 'donor_agreement') requires recreating those tables -- SQLite/D1 cannot
-- ALTER a CHECK constraint in place. This follows migration 0059's
-- verified-safe rebuild sequence exactly (see that file's own extensive
-- comment for why PRAGMA foreign_keys/defer_foreign_keys toggling is
-- actively broken under D1's implicit-transaction execution model):
-- rebuild the FK parent (content_items) into a *_next name first, repoint
-- every existing dependent table (content_item_tags, member_submissions,
-- publication_candidates, moderation_events, rights_evidence) via its own
-- individual leaf-table rebuild, only then drop the old parent and rename
-- the replacement into place. `archive_items` and
-- `archive_item_custody_events` are brand new tables created at the very
-- end, referencing the final `content_items`/`archive_items` directly --
-- they need no repointing because they never existed before this
-- migration.
--
-- Every column, constraint, default, and index from migrations
-- 0042/0057/0059 (content_items) and 0055/0059/0061 (rights_evidence) is
-- carried over verbatim below; this migration only adds the two new CHECK
-- values plus the two new tables. No existing row's data is reinterpreted.

-- ---------------------------------------------------------------------------
-- Part A: rebuild content_items with 'physical_acquisition' added to
-- input_stream. Identical to 0059's content_items_next definition in every
-- other respect.
-- ---------------------------------------------------------------------------

CREATE TABLE content_items_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL UNIQUE,
  input_stream TEXT NOT NULL CHECK (input_stream IN (
    'public_research', 'member_submission', 'admin_seed', 'scheduled_discovery',
    'physical_acquisition'
  )),
  title TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT NOT NULL,
  source_owner TEXT,
  source_domain TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'archive', 'museum', 'newspaper', 'library', 'member', 'social',
    'auction', 'institution', 'operator', 'other'
  )),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'photo', 'article', 'record', 'story', 'video', 'audio', 'artifact', 'quote',
    'timeline_fact', 'biography_note', 'source_lead', 'correction', 'identification', 'other'
  )),
  summary TEXT NOT NULL,
  date_or_period TEXT,
  provenance_notes TEXT,
  rights_status TEXT NOT NULL CHECK (rights_status IN (
    'unknown', 'public_domain_candidate', 'permission_needed', 'permission_requested',
    'permission_granted', 'copyright_restricted', 'blocked', 'lgfc_owned_confirmed'
  )),
  source_trust_status TEXT NOT NULL CHECK (source_trust_status IN (
    'pending', 'trusted', 'questionable', 'blocked', 'deleted'
  )),
  relevance_status TEXT NOT NULL CHECK (relevance_status IN (
    'pending', 'relevant', 'not_relevant', 'uncertain'
  )),
  review_status TEXT NOT NULL CHECK (review_status IN (
    'pending_review', 'approved_internal_reference', 'approved_public_candidate',
    'approved_citation_reference_only', 'deferred_source_verification', 'deferred_rights_review',
    'deferred_privacy_review', 'rejected', 'private_internal_only'
  )),
  publication_status TEXT NOT NULL CHECK (publication_status IN (
    'not_ready', 'draft_candidate', 'staged', 'approved_for_publish',
    'published', 'unpublished', 'archived'
  )),
  publication_target TEXT CHECK (publication_target IS NULL OR publication_target IN (
    'biography', 'timeline', 'gallery', 'library', 'memorabilia', 'article',
    'homepage_feature', 'lou_gehrig_day', 'newsletter', 'social', 'internal_reference_only'
  )),
  privacy_flag TEXT NOT NULL CHECK (privacy_flag IN (
    'none', 'living_person', 'donor_member', 'minors', 'sensitive', 'other'
  )),
  privacy_review_status TEXT NOT NULL CHECK (privacy_review_status IN (
    'not_applicable', 'pending_review', 'approved', 'restricted', 'blocked'
  )),
  credit_line TEXT,
  media_asset_id TEXT,
  duplicate_of TEXT,
  review_priority TEXT NOT NULL CHECK (review_priority IN ('low', 'normal', 'high')),
  admin_notes TEXT,
  source_metadata TEXT NOT NULL DEFAULT '{}',
  source_id INTEGER REFERENCES sources(id),
  submission_queue_id INTEGER REFERENCES submission_queue(submission_id),
  content_inventory_id INTEGER REFERENCES content_inventory(id),
  last_event_at TEXT,
  deleted_at TEXT,
  retention_reason TEXT,
  purge_eligible_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  curator_decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (curator_decision IN ('pending', 'approved', 'disapproved', 'delete')),
  curator_decision_by TEXT,
  curator_decision_at TEXT,
  curator_decision_notes TEXT,
  FOREIGN KEY (duplicate_of) REFERENCES content_items_next(candidate_id) DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO content_items_next SELECT * FROM content_items;

-- ---------------------------------------------------------------------------
-- Part B: repoint each existing dependent table onto content_items_next via
-- its own leaf-table rebuild (nothing references any of these five, so each
-- DROP TABLE below cascades nothing once its replacement is populated).
-- ---------------------------------------------------------------------------

-- content_item_tags
CREATE TABLE content_item_tags_next (
  content_item_id INTEGER NOT NULL REFERENCES content_items_next(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (content_item_id, tag_id)
);
INSERT INTO content_item_tags_next SELECT * FROM content_item_tags;
DROP TABLE content_item_tags;
ALTER TABLE content_item_tags_next RENAME TO content_item_tags;

-- member_submissions
CREATE TABLE member_submissions_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL UNIQUE REFERENCES content_items_next(id) ON DELETE CASCADE,
  submitter_id INTEGER REFERENCES submitters(id),
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'story', 'photo', 'memorabilia', 'correction', 'identification', 'source_lead', 'historical_note'
  )),
  ownership_statement TEXT NOT NULL,
  permission_statement TEXT NOT NULL,
  credit_preference TEXT NOT NULL CHECK (credit_preference IN (
    'public_credit', 'anonymous', 'private', 'custom'
  )),
  privacy_notes TEXT,
  uploaded_media_reference TEXT,
  related_candidate_id TEXT,
  consent_status TEXT NOT NULL CHECK (consent_status IN (
    'pending', 'granted', 'restricted', 'denied'
  )),
  admin_followup_required INTEGER NOT NULL CHECK (admin_followup_required IN (0, 1)),
  submission_queue_id INTEGER REFERENCES submission_queue(submission_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO member_submissions_next SELECT * FROM member_submissions;
DROP TABLE member_submissions;
ALTER TABLE member_submissions_next RENAME TO member_submissions;

-- publication_candidates
CREATE TABLE publication_candidates_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_next(id) ON DELETE CASCADE,
  publication_target TEXT NOT NULL CHECK (publication_target IN (
    'biography', 'timeline', 'gallery', 'library', 'memorabilia', 'article',
    'homepage_feature', 'lou_gehrig_day', 'newsletter', 'social', 'internal_reference_only'
  )),
  credit_line TEXT,
  staging_notes TEXT,
  approved_by TEXT,
  approved_at TEXT,
  content_inventory_id INTEGER REFERENCES content_inventory(id),
  status TEXT NOT NULL DEFAULT 'staging' CHECK (status IN (
    'staging', 'approved', 'converted', 'withdrawn'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO publication_candidates_next SELECT * FROM publication_candidates;
DROP TABLE publication_candidates;
ALTER TABLE publication_candidates_next RENAME TO publication_candidates;

-- moderation_events
CREATE TABLE moderation_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_next(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'review_state_change', 'rights_update', 'privacy_update', 'publication_prep',
    'duplicate_flagged', 'promotion', 'soft_delete', 'retention_update'
  )),
  actor TEXT,
  from_state TEXT,
  to_state TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO moderation_events_next SELECT * FROM moderation_events;
DROP TABLE moderation_events;
ALTER TABLE moderation_events_next RENAME TO moderation_events;

-- rights_evidence -- adds 'donor_agreement' to evidence_type; every other
-- column matches the current shape (0055 base + 0059's six columns + 0061's
-- three columns) verbatim.
CREATE TABLE rights_evidence_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_next(id) ON DELETE CASCADE,
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
    'public_domain_confirmed', 'permission_granted', 'lgfc_member_owned_item_photo'
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

-- ---------------------------------------------------------------------------
-- Part C: nothing references the OLD content_items anymore -- safe to drop.
-- Renaming content_items_next into place auto-rewrites the five dependents'
-- stored FK references (SQLite 3.25+ ALTER TABLE ... RENAME TO behavior),
-- same as 0059.
-- ---------------------------------------------------------------------------

DROP TABLE content_items;
ALTER TABLE content_items_next RENAME TO content_items;

-- ---------------------------------------------------------------------------
-- Part D: recreate every index that existed on any of the six rebuilt
-- tables before this migration, verbatim (copied from 0059's own recreate
-- list plus 0061's usage_decision index).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_content_items_review_queue
  ON content_items(
    review_status,
    CASE review_priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    updated_at DESC
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_publication_status
  ON content_items(publication_status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_input_stream
  ON content_items(input_stream, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_source_trust
  ON content_items(source_trust_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_rights_status
  ON content_items(rights_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_privacy_review
  ON content_items(privacy_review_status, privacy_flag)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_duplicate_of
  ON content_items(duplicate_of)
  WHERE duplicate_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_media_asset
  ON content_items(media_asset_id)
  WHERE media_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_submission_queue
  ON content_items(submission_queue_id)
  WHERE submission_queue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_content_inventory
  ON content_items(content_inventory_id)
  WHERE content_inventory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_source_id
  ON content_items(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_deleted_at
  ON content_items(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_purge_eligible
  ON content_items(purge_eligible_at)
  WHERE purge_eligible_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_curator_decision
  ON content_items(curator_decision, curator_decision_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_item_tags_tag
  ON content_item_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_member_submissions_submitter
  ON member_submissions(submitter_id);

CREATE INDEX IF NOT EXISTS idx_member_submissions_consent
  ON member_submissions(consent_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_submissions_queue
  ON member_submissions(submission_queue_id)
  WHERE submission_queue_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_publication_candidates_item_target
  ON publication_candidates(content_item_id, publication_target);

CREATE INDEX IF NOT EXISTS idx_publication_candidates_content_item
  ON publication_candidates(content_item_id, status);

CREATE INDEX IF NOT EXISTS idx_publication_candidates_target
  ON publication_candidates(publication_target, status);

CREATE INDEX IF NOT EXISTS idx_moderation_events_content_item_created
  ON moderation_events(content_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_events_event_type
  ON moderation_events(event_type, created_at DESC);

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

-- ---------------------------------------------------------------------------
-- Part E: new tables. Both are brand new -- no rebuild/repoint needed,
-- they reference the final content_items/archive_items directly.
-- ---------------------------------------------------------------------------

-- One archive_items row per physical item offered/received, 1:1 with the
-- content_items row that anchors its identity, rights, and audit trail.
-- #4059 decision 4: donor_name/donor_contact are admin-only by construction
-- (no public read path reads this table at all -- see the companion
-- repository module); credit_line is the only donor-attributable field any
-- public surface may show, and only once donor_consent_public_credit = 1.
CREATE TABLE IF NOT EXISTS archive_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'photograph', 'letter', 'document', 'memorabilia', 'audio', 'video', 'other'
  )),
  -- #4059 decision 1: donation (permanent) and loan (temporary) are tracked
  -- as one state machine, distinguished by custody_type.
  custody_type TEXT NOT NULL CHECK (custody_type IN ('donation', 'loan')),
  custody_state TEXT NOT NULL DEFAULT 'offered' CHECK (custody_state IN (
    'offered', 'received', 'cataloged', 'stored', 'returned', 'deaccessioned'
  )),
  -- Only meaningful when custody_type = 'loan'; NULL for a donation.
  loan_expected_return_at TEXT,
  loan_returned_at TEXT,
  -- #4059 decision 5: D1 metadata only for this phase, no vendor integration.
  storage_location TEXT,
  condition_notes TEXT,
  -- #4059 decision 4: admin-only donor identity/contact, never read by any
  -- public route.
  donor_name TEXT,
  donor_contact TEXT,
  donor_consent_public_credit INTEGER NOT NULL DEFAULT 0
    CHECK (donor_consent_public_credit IN (0, 1)),
  -- Public only when donor_consent_public_credit = 1; enforced at the
  -- repository/API layer, not by a DB-level read restriction (this table
  -- has no public read path today -- see the module-level comment in
  -- functions/_lib/archive-items-repository.ts).
  credit_line TEXT,
  intake_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_archive_items_custody_state
  ON archive_items(custody_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_archive_items_custody_type
  ON archive_items(custody_type, custody_state);

CREATE INDEX IF NOT EXISTS idx_archive_items_loan_return
  ON archive_items(loan_expected_return_at)
  WHERE custody_type = 'loan' AND loan_returned_at IS NULL;

-- Append-only custody-state audit trail (#4059 decision 2: custody-state
-- changes are PMO/ops-operated, matching #3551's room/participant and
-- rights-review precedent -- admin-authenticated only, not self-service).
-- Mirrors this repo's existing moderation_events/content_audit_events
-- append-only convention: a state change is a new row, never an edit to a
-- prior one.
CREATE TABLE IF NOT EXISTS archive_item_custody_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archive_item_id INTEGER NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL CHECK (to_state IN (
    'offered', 'received', 'cataloged', 'stored', 'returned', 'deaccessioned'
  )),
  actor TEXT NOT NULL,
  note TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_archive_item_custody_events_item
  ON archive_item_custody_events(archive_item_id, recorded_at DESC);
