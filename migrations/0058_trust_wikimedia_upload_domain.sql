-- 0058_trust_wikimedia_upload_domain.sql
-- #3552: migration 0055 seeded 'commons.wikimedia.org' (the Commons file
-- *description page* host) as a trusted source, but the ingestion endpoint's
-- source_fetch_url must point at the actual image bytes, which Wikimedia
-- Commons serves from a different host: upload.wikimedia.org. Since
-- validateIngestSourceUrl only allows an exact or subdomain match against an
-- allowlisted domain, and upload.wikimedia.org is a sibling host (not a
-- subdomain) of commons.wikimedia.org, every real Commons ingestion would
-- have been rejected until this is added. Found while building the first
-- real batch ingestion for #3551/#3552 -- no ingestion had been attempted
-- against a live source before this.

INSERT OR IGNORE INTO sources (source_domain, source_name, source_type, source_trust_status, source_citation)
VALUES (
  'upload.wikimedia.org',
  'Wikimedia Commons (media host)',
  'archive',
  'trusted',
  'Wikimedia Commons original-file host, distinct from the commons.wikimedia.org description-page host seeded in migration 0055'
);
