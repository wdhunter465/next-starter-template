-- 4571_story_sources.sql
-- #4571 (child of #4523): Product approved (2026-10-11) adding Wikipedia, Wikisource and the
-- Internet Archive as D1 sources before any story import.
--
-- Not a migration: migrations apply to Production on merge, and this seed's Production apply
-- needs Product's Go on #4571. Apply by hand, Development first:
--   npx wrangler d1 execute lgfc-litedev --env preview --remote \
--     --file scripts/content-pipeline/seeds/4571_story_sources.sql
--
-- Idempotent: INSERT OR IGNORE against the partial unique index on sources(source_domain)
-- (migration 0042). A domain that already has a row is left unchanged. No deletes, no updates.
-- standing stays 'unknown': nothing is permitted until per-item evidence says so.

INSERT OR IGNORE INTO sources (
  source_domain, source_name, source_type, source_trust_status, source_citation,
  cost_model, cost_notes, search_enabled, standing
)
VALUES
  (
    'en.wikipedia.org', 'Wikipedia (English)', 'other', 'trusted',
    'English Wikipedia articles; text under CC BY-SA, with some public-domain material',
    'free',
    'Free to access. Text is CC BY-SA 4.0 (attribution and share-alike); embedded media carry their own licences. Terms confirmed per item.',
    1, 'unknown'
  ),
  (
    'en.wikisource.org', 'Wikisource (English)', 'library', 'trusted',
    'English Wikisource transcriptions of source texts, mostly public domain',
    'free',
    'Free to access. Transcribed works are mostly public domain; Wikisource additions are CC BY-SA 4.0. Public-domain status confirmed per item.',
    1, 'unknown'
  ),
  (
    'archive.org', 'Internet Archive', 'archive', 'trusted',
    'Internet Archive digitized texts, newspapers, audio, film and images',
    'free',
    'Free to access under the Internet Archive terms of use. Rights stay with the original holder; each item carries its own rights statement. Terms confirmed per item.',
    1, 'unknown'
  );
