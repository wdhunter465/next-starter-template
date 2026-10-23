-- 0088_internet_archive_source_4789.sql
-- #4789: register archive.org the same way migration 0055 registered the
-- other discovery hosts. Product Authority asked for this allowlist row in
-- that Issue. The collector stays opt-in (--sources internetarchive) and
-- this file does not by itself run a search or write candidates.
--
-- Do not treat a catalog hit as public domain. Rights text stays evidence.

INSERT OR IGNORE INTO sources (source_domain, source_name, source_type, source_trust_status, source_citation)
VALUES (
  'archive.org',
  'Internet Archive',
  'archive',
  'trusted',
  'Internet Archive search API for pre-1931 texts, images, and movies. Item rights and licenseurl are evidence, not a clearance. #4789'
);
