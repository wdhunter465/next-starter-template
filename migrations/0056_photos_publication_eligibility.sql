-- 0056_photos_publication_eligibility.sql
-- #3553: add publication_eligible / rights_status on photos.
-- Public and member-facing reads already fail closed on rights_hold (#3562).
-- This adds the Issue-specified eligibility flag and rights vocabulary.
--
-- Backfill preserves the later Product Authority B2 audit (#3564 / 0054):
-- rows already rights_hold = 0 stay publication_eligible = 1.
-- Every other existing row stays unpublished (publication_eligible = 0,
-- rights_status = 'unreviewed'). New rows default unpublished.
--
-- This task applies the migration to lgfc-litedev (Development) first.
-- Merging to main also queues lgfc_lite via d1-migrations.yml; that Production
-- apply is out of scope for #3553 and requires a separate Product Authority step.

PRAGMA foreign_keys = ON;

ALTER TABLE photos ADD COLUMN publication_eligible INTEGER NOT NULL DEFAULT 0
  CHECK (publication_eligible IN (0, 1));

ALTER TABLE photos ADD COLUMN rights_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (rights_status IN (
    'unreviewed',
    'unknown',
    'public_domain_candidate',
    'permission_needed',
    'permission_requested',
    'permission_granted',
    'copyright_restricted',
    'blocked'
  ));

ALTER TABLE photos ADD COLUMN reviewed_by TEXT;
ALTER TABLE photos ADD COLUMN reviewed_at TEXT;

UPDATE photos
SET publication_eligible = CASE WHEN COALESCE(rights_hold, 1) = 0 THEN 1 ELSE 0 END,
    rights_status = CASE
      WHEN COALESCE(rights_hold, 1) = 0 THEN 'permission_granted'
      ELSE 'unreviewed'
    END,
    reviewed_by = CASE
      WHEN COALESCE(rights_hold, 1) = 0
        THEN COALESCE(reviewed_by, 'b2_audit_cleared_lgfc_owned_2026_08_17')
      ELSE reviewed_by
    END,
    reviewed_at = CASE
      WHEN COALESCE(rights_hold, 1) = 0
        THEN COALESCE(reviewed_at, rights_hold_set_at)
      ELSE reviewed_at
    END;

CREATE INDEX IF NOT EXISTS idx_photos_publication_eligible
  ON photos (publication_eligible);
