-- 0065_archive_acquisition_core_rollback.sql
-- #2073 Work Package item 6 (#4063): hand-authored emergency schema
-- reversal for migrations/0065_archive_acquisition_core.sql.
--
-- THIS IS NOT A MIGRATIONS/ FILE. It must never be placed in migrations/ --
-- doing so would make it apply automatically (forward) via
-- `wrangler d1 migrations apply` / scripts/d1-prod-migrate.sh / every test
-- harness that globs migrations/*.sql, which is the opposite of what a
-- rollback script must do. This file is applied manually and only when an
-- operator has decided a full schema rollback (not just a code rollback --
-- see docs/ops/how-to/archive-item-rollback-recovery.md for why a code-only
-- rollback is almost always the right choice instead) is genuinely required.
--
-- ============================================================================
-- Why this has guard checks instead of just reversing unconditionally
-- ============================================================================
-- Migration 0065 is purely additive: it widens two CHECK constraints and
-- adds two new tables. Reversing it means narrowing those CHECK constraints
-- back and dropping the new tables -- which is only safe if nothing has
-- actually used the new surface yet. If any archive_items row, any
-- content_items row with input_stream = 'physical_acquisition', or any
-- rights_evidence row with evidence_type = 'donor_agreement' exists, blindly
-- reversing would either silently destroy real donor/custody data (dropping
-- archive_items) or abort mid-rebuild with a CHECK-constraint violation on
-- the INSERT INTO ..._prev SELECT step (narrowing content_items/
-- rights_evidence while a now-forbidden value still exists in the source
-- table) -- exactly the kind of half-applied, partially-dropped state that
-- migration 0059's own header warns a naive PRAGMA foreign_keys toggle can
-- produce under D1's implicit per-migration transaction. The three guard
-- inserts below fail loudly and abort the whole script (see
-- tests/migration-0065-archive-acquisition-rollback.test.ts, which exercises
-- both the guard-refuses-when-unsafe path and the clean-reversal path) --
-- which is the correct, safe failure mode: an operator who hits a refused
-- guard must first decide what to do with the real archive data (the
-- realistic answer is almost always "don't roll back the schema, just roll
-- back the code" -- see the runbook).
--
-- Every statement below runs inside one transaction so a guard failure or
-- any mid-rebuild error leaves the database exactly as it was.

BEGIN IMMEDIATE;

CREATE TABLE _rollback_0065_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO _rollback_0065_guard (ok)
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM archive_items) THEN 0
  WHEN EXISTS (SELECT 1 FROM content_items WHERE input_stream = 'physical_acquisition') THEN 0
  WHEN EXISTS (SELECT 1 FROM rights_evidence WHERE evidence_type = 'donor_agreement') THEN 0
  ELSE 1
END;

DROP TABLE _rollback_0065_guard;

-- ---------------------------------------------------------------------------
-- Part A: drop the two tables migration 0065 created. Guarded above to be
-- empty, so this discards no data.
-- ---------------------------------------------------------------------------

DROP TABLE archive_item_custody_events;
DROP TABLE archive_items;

-- ---------------------------------------------------------------------------
-- Part B: rebuild content_items without 'physical_acquisition' in
-- input_stream. Identical to 0065's content_items_next definition with that
-- one CHECK value removed -- every other column/constraint/default carried
-- over verbatim, matching 0065's own "only adds the two new CHECK values"
-- guarantee in reverse.
-- ---------------------------------------------------------------------------

CREATE TABLE content_items_prev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL UNIQUE,
  input_stream TEXT NOT NULL CHECK (input_stream IN (
    'public_research', 'member_submission', 'admin_seed', 'scheduled_discovery'
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
  FOREIGN KEY (duplicate_of) REFERENCES content_items_prev(candidate_id) DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO content_items_prev SELECT * FROM content_items;

-- content_item_tags
CREATE TABLE content_item_tags_prev (
  content_item_id INTEGER NOT NULL REFERENCES content_items_prev(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (content_item_id, tag_id)
);
INSERT INTO content_item_tags_prev SELECT * FROM content_item_tags;
DROP TABLE content_item_tags;
ALTER TABLE content_item_tags_prev RENAME TO content_item_tags;

-- member_submissions
CREATE TABLE member_submissions_prev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL UNIQUE REFERENCES content_items_prev(id) ON DELETE CASCADE,
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
INSERT INTO member_submissions_prev SELECT * FROM member_submissions;
DROP TABLE member_submissions;
ALTER TABLE member_submissions_prev RENAME TO member_submissions;

-- publication_candidates
CREATE TABLE publication_candidates_prev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_prev(id) ON DELETE CASCADE,
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
INSERT INTO publication_candidates_prev SELECT * FROM publication_candidates;
DROP TABLE publication_candidates;
ALTER TABLE publication_candidates_prev RENAME TO publication_candidates;

-- moderation_events
CREATE TABLE moderation_events_prev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_prev(id) ON DELETE CASCADE,
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
INSERT INTO moderation_events_prev SELECT * FROM moderation_events;
DROP TABLE moderation_events;
ALTER TABLE moderation_events_prev RENAME TO moderation_events;

-- rights_evidence -- removes 'donor_agreement' from evidence_type; every
-- other column matches verbatim.
CREATE TABLE rights_evidence_prev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_prev(id) ON DELETE CASCADE,
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
INSERT INTO rights_evidence_prev SELECT * FROM rights_evidence;
DROP TABLE rights_evidence;
ALTER TABLE rights_evidence_prev RENAME TO rights_evidence;

-- ---------------------------------------------------------------------------
-- Part C: nothing references the widened content_items anymore -- safe to
-- drop and rename the reverted replacement into place.
-- ---------------------------------------------------------------------------

DROP TABLE content_items;
ALTER TABLE content_items_prev RENAME TO content_items;

-- ---------------------------------------------------------------------------
-- Part D: recreate every index migration 0065 (re)created, verbatim.
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

COMMIT;
