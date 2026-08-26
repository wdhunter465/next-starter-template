-- 0061_rights_evidence_usage_decision.sql
-- #3552 phase 5 (#3748): a per-photo permit/deny/hold triage flag on
-- rights_evidence, separate from the existing detailed `conclusion`
-- (public_domain_confirmed / permission_granted / lgfc_member_owned_item_photo).
--
-- The gap this closes: `conclusion` stays NULL until a human explicitly
-- records one, so there is no persisted "this is unresolved, come back to
-- it" state -- content-pipeline-license-conclusion-mapping.ts's
-- mapLicenseToConclusion currently *throws* on unrecognized license text
-- rather than queuing it for review, which aborts an entire batch approval
-- run over one unexpected item. `usage_decision` gives every rights_evidence
-- row an explicit state (permit/deny/hold) so "unresolved" is data, not an
-- exception.
--
-- `source_filename` and `tagging_requirements` are captured alongside the
-- existing `evidence_url` (source URL) and `evidence_text` (copyright
-- status as found), so a single rights_evidence row documents where a
-- photo came from, what rights were found, and what attribution the source
-- requires, in one place.
--
-- `rights_evidence` stays append-only (see migration 0055's comment):
-- resolving a `hold` means recording a NEW row with usage_decision =
-- permit|deny, never mutating the held row in place.

ALTER TABLE rights_evidence ADD COLUMN source_filename TEXT;
ALTER TABLE rights_evidence ADD COLUMN tagging_requirements TEXT;
ALTER TABLE rights_evidence ADD COLUMN usage_decision TEXT NOT NULL DEFAULT 'hold'
  CHECK (usage_decision IN ('permit', 'deny', 'hold'));

-- Existing rows already carry LGFC's actual decision in `conclusion`; derive
-- usage_decision from that same row rather than leaving already-decided
-- rows looking unresolved. No row in the fixed conclusion vocabulary means
-- "deny" today, so only 'permit' needs backfilling here.
UPDATE rights_evidence SET usage_decision = 'permit' WHERE conclusion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_usage_decision
  ON rights_evidence(usage_decision)
  WHERE usage_decision = 'hold';
