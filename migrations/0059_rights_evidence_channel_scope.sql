-- 0059_rights_evidence_channel_scope.sql
-- #3657 (Package 1 of the #3551/#3552 gap-audit lineage): rights conclusions
-- must become channel/use-specific rather than one blanket approval, plus the
-- evidentiary-completeness items the audit found alongside it. This is
-- additive except for one deliberate, narrow exception: widening the CHECK
-- constraint on `content_items.rights_status` by exactly one new truthful
-- value. No row data changes for any existing row -- every rebuild below
-- copies existing rows through unchanged, it does not touch, reinterpret, or
-- migrate any existing value.
--
-- ============================================================================
-- IMPORTANT: why this migration does NOT use `PRAGMA foreign_keys = OFF`
-- ============================================================================
-- SQLite/D1 cannot ALTER a CHECK constraint in place, so widening
-- `content_items.rights_status`'s CHECK requires recreating that table.
-- `content_items` is the FK parent (ON DELETE CASCADE) of five other tables:
-- `content_item_tags`, `member_submissions`, `publication_candidates`,
-- `moderation_events`, `rights_evidence`.
--
-- An earlier draft of this migration bracketed the rebuild with
-- `PRAGMA foreign_keys = OFF` / `= ON`, matching how a plain sqlite3 session
-- would handle this safely. That was verified BROKEN against this repo's
-- actual local D1 (`wrangler d1 migrations apply ... --local`, i.e. the same
-- engine Production runs on): `wrangler`/D1 executes a migration file inside
-- an implicit transaction, and `PRAGMA foreign_keys` is a documented SQLite
-- no-op once a transaction is open -- it silently does not take effect.
-- `PRAGMA defer_foreign_keys = ON` was tried next; it also did not help,
-- because `DROP TABLE` on an FK parent fires the `ON DELETE CASCADE` action
-- itself (not just the constraint *check*) whenever foreign keys are
-- enabled at the schema level, and deferring only postpones the check, not
-- the cascade action. Both were reproduced empirically: seeding one row into
-- `content_items` and one linked row into each of the five dependent tables,
-- then applying a `PRAGMA foreign_keys`- or `defer_foreign_keys`-bracketed
-- rebuild, left `content_items` with its row intact but wiped all five
-- dependent tables to zero rows every time.
--
-- The only migration order that avoids this: rebuild the table that OTHERS
-- reference into a *new* name FIRST, then repoint each of the five
-- dependents onto that new name via their own individual rebuilds (each of
-- which is a plain leaf-table DROP -- nothing references `content_item_tags`,
-- `member_submissions`, `publication_candidates`, `moderation_events`, or
-- `rights_evidence`, confirmed by grepping every migration file for
-- `REFERENCES <that table>(` -- so dropping any one of them, once repointed,
-- cascades nothing). Only once all five no longer reference the OLD
-- `content_items` is it safe to drop it -- at that point nothing refers to
-- it, so there is nothing left to cascade. The final rename of the new table
-- into the `content_items` name relies on SQLite's automatic foreign-key
-- reference rewriting on `ALTER TABLE ... RENAME TO` (supported since SQLite
-- 3.25) to repoint the five dependents' stored schema from
-- `content_items_next` to `content_items` without touching their rows again.
-- This exact sequence was verified end-to-end against local D1 with seeded
-- rows in all six tables before finalizing this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Part A: additive columns on rights_evidence (simple ADD COLUMN -- these are
-- new nullable columns, not a CHECK change on an existing column, so no
-- rebuild is needed for this part specifically; the table gets rebuilt
-- anyway in Part B step 2 to repoint its content_items FK, at which point
-- these columns are simply carried over like every other existing column).
-- ---------------------------------------------------------------------------

ALTER TABLE rights_evidence ADD COLUMN channel TEXT CHECK (channel IS NULL OR channel IN (
  'website', 'social_media', 'newsletter_email', 'fundraiser_campaign', 'internal_archive_only'
));

ALTER TABLE rights_evidence ADD COLUMN rights_holder TEXT;
ALTER TABLE rights_evidence ADD COLUMN repository_or_collection TEXT;

ALTER TABLE rights_evidence ADD COLUMN publication_established INTEGER
  CHECK (publication_established IS NULL OR publication_established IN (0, 1));
ALTER TABLE rights_evidence ADD COLUMN us_publication_or_uraa_confirmed INTEGER
  CHECK (us_publication_or_uraa_confirmed IS NULL OR us_publication_or_uraa_confirmed IN (0, 1));
ALTER TABLE rights_evidence ADD COLUMN publication_date_source TEXT;

-- Backfill: every existing rights_evidence row that already has a non-NULL
-- `conclusion` was a real review conducted for website display under the
-- prior single-channel model (the only channel this pipeline supported
-- before this migration). Labeling those rows `channel = 'website'` is
-- describing what already happened accurately -- it is not fabricating new
-- authorization, and it does not extend any of these conclusions to cover
-- social_media, newsletter_email, fundraiser_campaign, or
-- internal_archive_only, which none of these reviews ever considered.
--
-- This is explicitly NOT the same thing as, and creates NO precedent for,
-- the separate legacy-`photos` remediation tracked in #3658 (blocked on this
-- PR): the 844/848 legacy `photos` rows have no rights_evidence rows to
-- backfill in the first place, and #3658 requires real new per-item evidence
-- to be gathered and recorded, not a backfill label applied to evidence that
-- was never captured.
UPDATE rights_evidence
SET channel = 'website'
WHERE conclusion IS NOT NULL AND channel IS NULL;

-- ---------------------------------------------------------------------------
-- Part B step 1: build content_items_next with the widened rights_status
-- CHECK (adds exactly one new value: 'lgfc_owned_confirmed', representing
-- "LGFC itself owns/holds this item with no identified third-party rights
-- claim" -- distinct from 'permission_granted', which implies a third party
-- granted permission). Every other column, constraint, default, and index
-- definition is carried over unchanged from migrations 0042 + 0057.
-- content_items itself is NOT dropped yet -- both tables coexist with
-- identical data until every dependent table has been repointed below.
-- ---------------------------------------------------------------------------

CREATE TABLE content_items_next (
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
  FOREIGN KEY (duplicate_of) REFERENCES content_items_next(candidate_id)
);

INSERT INTO content_items_next SELECT * FROM content_items;

-- ---------------------------------------------------------------------------
-- Part B step 2: repoint each of the five dependent tables from
-- `content_items` to `content_items_next` via its own leaf-table rebuild.
-- Nothing references any of these five tables (verified by grepping every
-- migration file for `REFERENCES <table>(`), so dropping each one, once its
-- replacement is populated, cascades nothing.
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

-- rights_evidence (includes Part A's six new columns, already added above)
CREATE TABLE rights_evidence_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL REFERENCES content_items_next(id) ON DELETE CASCADE,
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
  publication_date_source TEXT
);
INSERT INTO rights_evidence_next SELECT * FROM rights_evidence;
DROP TABLE rights_evidence;
ALTER TABLE rights_evidence_next RENAME TO rights_evidence;

-- ---------------------------------------------------------------------------
-- Part B step 3: nothing references the OLD content_items anymore (every
-- dependent has been repointed to content_items_next above) -- safe to drop.
-- Then rename content_items_next into place; SQLite automatically rewrites
-- the five dependents' stored FK references from content_items_next to
-- content_items as part of this RENAME (supported since SQLite 3.25).
-- ---------------------------------------------------------------------------

DROP TABLE content_items;
ALTER TABLE content_items_next RENAME TO content_items;

-- ---------------------------------------------------------------------------
-- Part B step 4: recreate every index that existed on any of the six
-- rebuilt tables before this migration, verbatim.
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
