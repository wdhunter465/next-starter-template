-- 0054_b2_audit_clear_existing_media.sql
-- #3552: Bill completed the mandated per-item B2 media review (the quarantine
-- step from migration 0053). Finding: files currently in B2 can be used on
-- the LGFC website -- this is LGFC-owned/audited content (#3551's
-- `lgfc_member_owned_item_photo` rights basis), distinct from the new
-- allowlisted-discovery pipeline, which still requires its own per-item
-- evidence review before anything it collects can clear `rights_hold`.
--
-- This lifts the hold only for rows that existed at audit time (identified by
-- the reason migration 0053 set). The column's fail-closed default (held=1)
-- is unchanged, so any row inserted after this migration -- including new
-- discovery-pipeline candidates -- still starts held until explicitly
-- cleared through its own review.

PRAGMA foreign_keys = ON;

UPDATE photos
SET rights_hold = 0,
    rights_hold_reason = 'b2_audit_cleared_lgfc_owned_2026_08_17',
    rights_hold_set_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE rights_hold_reason = 'legacy_content_pending_rights_review_2026_08_17';

UPDATE media_assets
SET rights_hold = 0,
    rights_hold_reason = 'b2_audit_cleared_lgfc_owned_2026_08_17',
    rights_hold_set_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE rights_hold_reason = 'legacy_content_pending_rights_review_2026_08_17';
