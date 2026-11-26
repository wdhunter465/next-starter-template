-- 0103_permission_grants_eig_5226.sql
-- #5226: record Jonathan Eig's permission to use text excerpts from "Luckiest Man". Product Authority, 2026-11-26:
-- permission covers text stories and quotes only, no photos; given directly by the author, no fee.
--
--   1. permission_grants.party gains 'eig'. SQLite cannot alter a CHECK constraint, so the table is rebuilt:
--      every existing row is copied as is (same ids and values), then the indexes, triggers and the three
--      views that read the table are created again, unchanged. The views still compute only the cmg, mlb and
--      yankees layers; this migration does not change any computed status.
--   2. One grant row is written: party eig, approved, website and social, scope source_owner 'Jonathan Eig',
--      text only, with the credit wording.
--
-- Rollback: take a D1 export first. To reverse, revoke the eig row (revoke only; rows are append-only), or
-- rebuild the table with the old CHECK after removing it. Holds no member data.

DROP VIEW IF EXISTS content_item_permission_status;
DROP VIEW IF EXISTS content_item_party_grants;
DROP VIEW IF EXISTS permission_grant_matches;

CREATE TABLE permission_grants_5226 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party TEXT NOT NULL CHECK (party IN ('cmg', 'mlb', 'yankees', 'eig')),
  rights_holder TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'denied', 'not_in_purview')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('all', 'source_domain', 'source_owner', 'content_type', 'content_item')),
  scope_value TEXT,
  permitted_website INTEGER NOT NULL DEFAULT 0 CHECK (permitted_website IN (0, 1)),
  permitted_social INTEGER NOT NULL DEFAULT 0 CHECK (permitted_social IN (0, 1)),
  effective_from TEXT,
  effective_until TEXT,
  terms_text TEXT,
  credit_wording TEXT,
  exchange_id INTEGER REFERENCES permission_exchanges (id),
  message_id INTEGER REFERENCES permission_messages (id),
  recorded_by TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  revoked_reason TEXT,
  CHECK ((scope_type = 'all' AND scope_value IS NULL) OR (scope_type <> 'all' AND scope_value IS NOT NULL)),
  CHECK (status = 'approved' OR (permitted_website = 0 AND permitted_social = 0)),
  CHECK (status <> 'approved' OR permitted_website = 1 OR permitted_social = 1),
  CHECK (effective_from IS NULL OR effective_until IS NULL OR effective_from < effective_until),
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

INSERT INTO permission_grants_5226 (id, party, rights_holder, status, scope_type, scope_value, permitted_website, permitted_social, effective_from, effective_until, terms_text, credit_wording, exchange_id, message_id, recorded_by, recorded_at, revoked_at, revoked_reason)
SELECT id, party, rights_holder, status, scope_type, scope_value, permitted_website, permitted_social, effective_from, effective_until, terms_text, credit_wording, exchange_id, message_id, recorded_by, recorded_at, revoked_at, revoked_reason FROM permission_grants;

DROP TABLE permission_grants;
ALTER TABLE permission_grants_5226 RENAME TO permission_grants;

CREATE INDEX IF NOT EXISTS idx_permission_grants_party_status
  ON permission_grants (party, status) WHERE revoked_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_permission_grants_no_delete
BEFORE DELETE ON permission_grants
BEGIN
  SELECT RAISE(ABORT, 'permission_grants rows are append-only; revoke instead of deleting');
END;

CREATE TRIGGER IF NOT EXISTS trg_permission_grants_revoke_only
BEFORE UPDATE ON permission_grants
WHEN OLD.revoked_at IS NOT NULL
  OR NEW.id IS NOT OLD.id OR NEW.party IS NOT OLD.party OR NEW.rights_holder IS NOT OLD.rights_holder
  OR NEW.status IS NOT OLD.status OR NEW.scope_type IS NOT OLD.scope_type OR NEW.scope_value IS NOT OLD.scope_value
  OR NEW.permitted_website IS NOT OLD.permitted_website OR NEW.permitted_social IS NOT OLD.permitted_social
  OR NEW.effective_from IS NOT OLD.effective_from OR NEW.effective_until IS NOT OLD.effective_until
  OR NEW.terms_text IS NOT OLD.terms_text OR NEW.credit_wording IS NOT OLD.credit_wording
  OR NEW.exchange_id IS NOT OLD.exchange_id OR NEW.message_id IS NOT OLD.message_id
  OR NEW.recorded_by IS NOT OLD.recorded_by OR NEW.recorded_at IS NOT OLD.recorded_at
BEGIN
  SELECT RAISE(ABORT, 'permission_grants rows are append-only; the only edit is to revoke once');
END;

-- ---------------------------------------------------------------------------
-- content_item_permission_status: the computed answer per live record and channel
-- ---------------------------------------------------------------------------
-- Per party and channel: denied (a denial, or the legacy column says not_permitted), approved (a
-- grant covering the channel, or the legacy column says permitted), not_covered (approved only for
-- the other channel), not_applicable, or pending. Grants count only while not revoked and inside
-- their dates. computed_status_*: not_permitted if the origin or privacy layer is not permitted,
-- the outcome basis is fee_required, or any party layer is denied or not_covered; permitted if the
-- origin is permitted, privacy is permitted or not applicable, and every party layer is approved or
-- not applicable; otherwise for_admin_review.

-- One row per live content record and per active grant that covers it.
CREATE VIEW IF NOT EXISTS permission_grant_matches AS
SELECT ci.id AS content_item_id, g.id AS grant_id, g.party, g.status, g.permitted_website, g.permitted_social
  FROM content_items ci
  JOIN permission_grants g
    ON g.revoked_at IS NULL
   AND (g.effective_from IS NULL OR g.effective_from <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   AND (g.effective_until IS NULL OR g.effective_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   AND (g.scope_type = 'all'
        OR (g.scope_type = 'content_item' AND g.scope_value = CAST(ci.id AS TEXT))
        OR (g.scope_type = 'source_domain' AND g.scope_value = ci.source_domain)
        OR (g.scope_type = 'source_owner' AND g.scope_value = ci.source_owner)
        OR (g.scope_type = 'content_type' AND g.scope_value = ci.content_type))
 WHERE ci.superseded_at IS NULL;

-- Per record: for each party, whether an active grant denies, approves each channel, approves
-- at all, or says not in purview.
CREATE VIEW IF NOT EXISTS content_item_party_grants AS
SELECT content_item_id,
       MAX(party = 'cmg' AND status = 'denied') AS cmg_denied,
       MAX(party = 'cmg' AND status = 'approved' AND permitted_website = 1) AS cmg_approved_website,
       MAX(party = 'cmg' AND status = 'approved' AND permitted_social = 1) AS cmg_approved_social,
       MAX(party = 'cmg' AND status = 'approved') AS cmg_approved_any,
       MAX(party = 'cmg' AND status = 'not_in_purview') AS cmg_not_in_purview,
       MAX(party = 'mlb' AND status = 'denied') AS mlb_denied,
       MAX(party = 'mlb' AND status = 'approved' AND permitted_website = 1) AS mlb_approved_website,
       MAX(party = 'mlb' AND status = 'approved' AND permitted_social = 1) AS mlb_approved_social,
       MAX(party = 'mlb' AND status = 'approved') AS mlb_approved_any,
       MAX(party = 'mlb' AND status = 'not_in_purview') AS mlb_not_in_purview,
       MAX(party = 'yankees' AND status = 'denied') AS yankees_denied,
       MAX(party = 'yankees' AND status = 'approved' AND permitted_website = 1) AS yankees_approved_website,
       MAX(party = 'yankees' AND status = 'approved' AND permitted_social = 1) AS yankees_approved_social,
       MAX(party = 'yankees' AND status = 'approved') AS yankees_approved_any,
       MAX(party = 'yankees' AND status = 'not_in_purview') AS yankees_not_in_purview
  FROM permission_grant_matches
 GROUP BY content_item_id;

CREATE VIEW IF NOT EXISTS content_item_permission_status AS
SELECT content_item_id, candidate_id, origin_permission, privacy_status, outcome_basis,
       cmg_website, mlb_website, yankees_website, cmg_social, mlb_social, yankees_social,
       CASE
         WHEN origin_permission = 'not_permitted' OR privacy_status = 'not_permitted' OR outcome_basis = 'fee_required'
           OR cmg_website IN ('denied', 'not_covered') OR mlb_website IN ('denied', 'not_covered') OR yankees_website IN ('denied', 'not_covered') THEN 'not_permitted'
         WHEN origin_permission = 'permitted' AND privacy_status IN ('permitted', 'not_applicable')
           AND cmg_website IN ('approved', 'not_applicable') AND mlb_website IN ('approved', 'not_applicable') AND yankees_website IN ('approved', 'not_applicable') THEN 'permitted'
         ELSE 'for_admin_review'
       END AS computed_status_website,
       CASE
         WHEN origin_permission = 'not_permitted' OR privacy_status = 'not_permitted' OR outcome_basis = 'fee_required'
           OR cmg_social IN ('denied', 'not_covered') OR mlb_social IN ('denied', 'not_covered') OR yankees_social IN ('denied', 'not_covered') THEN 'not_permitted'
         WHEN origin_permission = 'permitted' AND privacy_status IN ('permitted', 'not_applicable')
           AND cmg_social IN ('approved', 'not_applicable') AND mlb_social IN ('approved', 'not_applicable') AND yankees_social IN ('approved', 'not_applicable') THEN 'permitted'
         ELSE 'for_admin_review'
       END AS computed_status_social
  FROM (
    SELECT ci.id AS content_item_id, ci.candidate_id, ci.origin_permission, ci.privacy_status, ci.outcome_basis,
           CASE
             WHEN COALESCE(pg.cmg_denied, 0) = 1 OR ci.cmg_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.cmg_approved_website, 0) = 1 OR ci.cmg_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.cmg_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.cmg_not_in_purview, 0) = 1 OR ci.cmg_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS cmg_website,
           CASE
             WHEN COALESCE(pg.mlb_denied, 0) = 1 OR ci.mlb_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.mlb_approved_website, 0) = 1 OR ci.mlb_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.mlb_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.mlb_not_in_purview, 0) = 1 OR ci.mlb_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS mlb_website,
           CASE
             WHEN COALESCE(pg.yankees_denied, 0) = 1 OR ci.yankees_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.yankees_approved_website, 0) = 1 OR ci.yankees_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.yankees_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.yankees_not_in_purview, 0) = 1 OR ci.yankees_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS yankees_website,
           CASE
             WHEN COALESCE(pg.cmg_denied, 0) = 1 OR ci.cmg_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.cmg_approved_social, 0) = 1 OR ci.cmg_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.cmg_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.cmg_not_in_purview, 0) = 1 OR ci.cmg_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS cmg_social,
           CASE
             WHEN COALESCE(pg.mlb_denied, 0) = 1 OR ci.mlb_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.mlb_approved_social, 0) = 1 OR ci.mlb_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.mlb_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.mlb_not_in_purview, 0) = 1 OR ci.mlb_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS mlb_social,
           CASE
             WHEN COALESCE(pg.yankees_denied, 0) = 1 OR ci.yankees_permission = 'not_permitted' THEN 'denied'
             WHEN COALESCE(pg.yankees_approved_social, 0) = 1 OR ci.yankees_permission = 'permitted' THEN 'approved'
             WHEN COALESCE(pg.yankees_approved_any, 0) = 1 THEN 'not_covered'
             WHEN COALESCE(pg.yankees_not_in_purview, 0) = 1 OR ci.yankees_permission = 'not_applicable' THEN 'not_applicable'
             ELSE 'pending'
           END AS yankees_social
      FROM content_items ci
      LEFT JOIN content_item_party_grants pg ON pg.content_item_id = ci.id
     WHERE ci.superseded_at IS NULL
  );

INSERT INTO permission_grants (party, rights_holder, status, scope_type, scope_value, permitted_website, permitted_social, terms_text, credit_wording, recorded_by)
VALUES ('eig', 'Jonathan Eig', 'approved', 'source_owner', 'Jonathan Eig', 1, 1,
  'Text stories and quotes from the book Luckiest Man only. No photos. Permission given directly by the author to Product Authority (Bill), before 2026-11-13; no fee, no length limit stated. Recorded 2026-11-26 on #5226.',
  'From Luckiest Man: The Life and Death of Lou Gehrig by Jonathan Eig (Simon & Schuster, 2005). Used with the author''s permission.',
  'Product Authority (recorded by Claude Code, #5226)');
