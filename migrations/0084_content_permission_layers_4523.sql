-- 0084_content_permission_layers_4523.sql
-- #4523: structured permission layers, decision basis, fee-required flag, supersession
-- and source cost/standing, per docs/reference/website/lou-gehrig-content-record-d1-design.md.
--
-- Purely additive: only ALTER TABLE ... ADD COLUMN, new triggers and one view. No existing
-- column or CHECK is altered, no table is rebuilt, and no row is deleted. Every new column is
-- NOT NULL DEFAULT (or nullable), so existing rows backfill without a rebuild.
--
-- The site does not read any of these columns until the publishing gate (#4528), so applying
-- this migration changes nothing that visitors see. Nothing becomes 'permitted' here: the
-- default for final_status is 'not_permitted', and the CMG, MLB, Yankees and privacy layers
-- default to 'for_admin_review' (decided: assumed blanket, each party must confirm; #4527).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- sources: cost flag and the origin's overall standing
-- ---------------------------------------------------------------------------
ALTER TABLE sources ADD COLUMN cost_model TEXT NOT NULL DEFAULT 'unknown'
  CHECK (cost_model IN ('free', 'fee', 'subscription', 'api_key', 'unknown'));
ALTER TABLE sources ADD COLUMN cost_notes TEXT;
ALTER TABLE sources ADD COLUMN cost_flagged_at TEXT;
ALTER TABLE sources ADD COLUMN search_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (search_enabled IN (0, 1));
ALTER TABLE sources ADD COLUMN standing TEXT NOT NULL DEFAULT 'unknown'
  CHECK (standing IN ('granted', 'denied', 'pending', 'unknown'));
ALTER TABLE sources ADD COLUMN standing_at TEXT;

-- ---------------------------------------------------------------------------
-- content_items: the permission layers, the outcome and supersession
-- ---------------------------------------------------------------------------
ALTER TABLE content_items ADD COLUMN origin_permission TEXT NOT NULL DEFAULT 'not_permitted'
  CHECK (origin_permission IN ('permitted', 'not_permitted', 'not_applicable', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN cmg_permission TEXT NOT NULL DEFAULT 'for_admin_review'
  CHECK (cmg_permission IN ('permitted', 'not_permitted', 'not_applicable', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN mlb_permission TEXT NOT NULL DEFAULT 'for_admin_review'
  CHECK (mlb_permission IN ('permitted', 'not_permitted', 'not_applicable', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN yankees_permission TEXT NOT NULL DEFAULT 'for_admin_review'
  CHECK (yankees_permission IN ('permitted', 'not_permitted', 'not_applicable', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN privacy_status TEXT NOT NULL DEFAULT 'for_admin_review'
  CHECK (privacy_status IN ('permitted', 'not_permitted', 'not_applicable', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN final_status TEXT NOT NULL DEFAULT 'not_permitted'
  CHECK (final_status IN ('permitted', 'not_permitted', 'for_admin_review'));
ALTER TABLE content_items ADD COLUMN outcome_basis TEXT NOT NULL DEFAULT 'pending'
  CHECK (outcome_basis IN (
    'origin_statement', 'email_permission', 'email_denial', 'no_response', 'fee_required',
    'public_domain', 'manual_lgfc_decision', 'pending'
  ));
ALTER TABLE content_items ADD COLUMN outcome_set_at TEXT;
ALTER TABLE content_items ADD COLUMN outcome_set_by TEXT;
-- A newer dated record supersedes an older one; the older row is kept (permanent retention).
ALTER TABLE content_items ADD COLUMN superseded_at TEXT;
ALTER TABLE content_items ADD COLUMN superseded_by TEXT;
-- References permission_exchanges(id), added by #4526. No foreign key until that table exists.
ALTER TABLE content_items ADD COLUMN permission_exchange_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_content_items_final_status
  ON content_items(final_status)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_source_url_active
  ON content_items(source_url)
  WHERE superseded_at IS NULL AND source_url IS NOT NULL;

-- Selection and publishing read this view, so a superseded record can never be used.
CREATE VIEW IF NOT EXISTS active_content_items AS
  SELECT * FROM content_items WHERE superseded_at IS NULL;

-- final_status = 'permitted' only when the origin layer is permitted and every other layer is
-- permitted or not_applicable. A fee-required outcome can never be permitted.
CREATE TRIGGER IF NOT EXISTS trg_content_items_final_status_insert
BEFORE INSERT ON content_items
WHEN NEW.final_status = 'permitted' AND (
  NEW.origin_permission <> 'permitted'
  OR NEW.cmg_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.mlb_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.yankees_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.privacy_status NOT IN ('permitted', 'not_applicable')
  OR NEW.outcome_basis = 'fee_required'
)
BEGIN
  SELECT RAISE(ABORT, 'final_status permitted requires origin permitted and every other layer permitted or not_applicable');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_final_status_update
BEFORE UPDATE ON content_items
WHEN NEW.final_status = 'permitted' AND (
  NEW.origin_permission <> 'permitted'
  OR NEW.cmg_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.mlb_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.yankees_permission NOT IN ('permitted', 'not_applicable')
  OR NEW.privacy_status NOT IN ('permitted', 'not_applicable')
  OR NEW.outcome_basis = 'fee_required'
)
BEGIN
  SELECT RAISE(ABORT, 'final_status permitted requires origin permitted and every other layer permitted or not_applicable');
END;

-- ---------------------------------------------------------------------------
-- rights_evidence: how the use is allowed, the fee flag and a hash of the origin's wording
-- ---------------------------------------------------------------------------
ALTER TABLE rights_evidence ADD COLUMN usage_basis TEXT NOT NULL DEFAULT 'unknown'
  CHECK (usage_basis IN ('free_use', 'free_use_credit', 'free_use_permission', 'fee_required', 'unknown'));
ALTER TABLE rights_evidence ADD COLUMN fee_required INTEGER NOT NULL DEFAULT 0
  CHECK (fee_required IN (0, 1));
ALTER TABLE rights_evidence ADD COLUMN evidence_text_sha256 TEXT;
-- References permission_exchanges(id), added by #4526. No foreign key until that table exists.
ALTER TABLE rights_evidence ADD COLUMN exchange_id INTEGER;

-- A fee-required item is never usable: it must be recorded as a denial.
CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_fee_required_insert
BEFORE INSERT ON rights_evidence
WHEN (NEW.fee_required = 1 OR NEW.usage_basis = 'fee_required') AND NEW.usage_decision <> 'deny'
BEGIN
  SELECT RAISE(ABORT, 'fee-required evidence must have usage_decision deny');
END;

CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_fee_required_update
BEFORE UPDATE ON rights_evidence
WHEN (NEW.fee_required = 1 OR NEW.usage_basis = 'fee_required') AND NEW.usage_decision <> 'deny'
BEGIN
  SELECT RAISE(ABORT, 'fee-required evidence must have usage_decision deny');
END;

-- ---------------------------------------------------------------------------
-- Backfill: records whose existing evidence already permits use get origin_permission
-- 'permitted'. final_status is NOT changed (it stays 'not_permitted') because the CMG, MLB,
-- Yankees and privacy layers are still for_admin_review; the site does not read these
-- columns until #4528, so what is shown does not change.
-- ---------------------------------------------------------------------------
UPDATE content_items
SET origin_permission = 'permitted',
    outcome_basis = CASE
      WHEN EXISTS (SELECT 1 FROM rights_evidence re
                   WHERE re.content_item_id = content_items.id
                     AND re.usage_decision = 'permit'
                     AND re.conclusion = 'public_domain_confirmed') THEN 'public_domain'
      WHEN EXISTS (SELECT 1 FROM rights_evidence re
                   WHERE re.content_item_id = content_items.id
                     AND re.usage_decision = 'permit'
                     AND re.conclusion = 'permission_granted'
                     AND re.evidence_type IN ('openverse_license', 'commons_license',
                                              'loc_statement', 'dpla_rights_statement')) THEN 'origin_statement'
      ELSE 'manual_lgfc_decision'
    END
WHERE id IN (
  SELECT content_item_id FROM rights_evidence
  WHERE usage_decision = 'permit'
    AND conclusion IN ('public_domain_confirmed', 'permission_granted', 'lgfc_member_owned_item_photo')
);
