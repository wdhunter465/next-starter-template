-- 0045_rights_privacy_evidence_controls.sql
-- Task #2919 (Project #2784): rights/consent capture, takedown-audit, and
-- administrator soft-deletion evidence controls. Forward-only; no data is
-- destroyed. Existing rows are left NULL/default and are unaffected.

-- F4 — rights/consent capture on the live public submission intake path
-- (submission_queue, read by /admin/editorial). Nullable at the DB layer
-- because existing rows predate this control; the API layer enforces
-- fail-closed validation for new submissions (see functions/api/library/submit.ts).
ALTER TABLE submission_queue ADD COLUMN ownership_statement TEXT;
ALTER TABLE submission_queue ADD COLUMN permission_statement TEXT;
ALTER TABLE submission_queue ADD COLUMN credit_preference TEXT
  CHECK (credit_preference IS NULL OR credit_preference IN ('public_credit', 'anonymous', 'private', 'custom'));
ALTER TABLE submission_queue ADD COLUMN consent_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (consent_status IN ('pending', 'granted', 'restricted', 'denied'));

CREATE INDEX IF NOT EXISTS idx_submission_queue_consent_status
  ON submission_queue(consent_status, updated_at DESC);

-- F5 — auditable internal takedown/suppression evidence on the published
-- content table. No new public route; recorded by an admin action against
-- an existing content_inventory record after a takedown request arrives
-- through the existing /contact email intake.
ALTER TABLE content_inventory ADD COLUMN suppression_reason TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_request_source TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_resolution_note TEXT;
ALTER TABLE content_inventory ADD COLUMN takedown_requested_at TEXT;

CREATE INDEX IF NOT EXISTS idx_content_inventory_suppression
  ON content_inventory(status, takedown_requested_at)
  WHERE suppression_reason IS NOT NULL;

-- F6 — administrator-controlled soft deletion. No hard delete path exists
-- or is authorized; these columns are the only deletion mechanism.
ALTER TABLE members ADD COLUMN deleted_at TEXT;
ALTER TABLE members ADD COLUMN deletion_reason TEXT;
ALTER TABLE members ADD COLUMN deleted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_members_deleted_at
  ON members(deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE join_requests ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_join_requests_deleted_at
  ON join_requests(deleted_at)
  WHERE deleted_at IS NOT NULL;
