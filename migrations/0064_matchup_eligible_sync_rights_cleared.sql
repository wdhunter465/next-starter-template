-- 0064_matchup_eligible_sync_rights_cleared.sql
-- Weekly Photo Matchup ("homepage weekly matchups") has been showing "No
-- matchup available this week" on both Development and Production because
-- no row has ever had is_matchup_eligible flipped to 1 (APPROVED) since the
-- rights_hold/publication_eligible columns were introduced (0053/0054/0056).
--
-- The rights review itself was already done, twice, through two legitimate
-- channels that both predate this migration:
--   - 0054's blanket Product Authority B2 audit
--     (rights_hold_reason = 'b2_audit_cleared_lgfc_owned_2026_08_17'),
--     covering LGFC-owned legacy photos.
--   - The content-collection/rights pipeline's rights_evidence table
--     (#3551/#3826): Bill Hunter personally reviewed and approved 10
--     Wikimedia Commons Gehrig photos on 2026-08-18, recorded per-item in
--     content_items/rights_evidence. functions/api/photos ingest already
--     synced that approval onto the matching photos rows' rights_hold=0 /
--     publication_eligible=1 -- it just never touched is_matchup_eligible.
--
-- is_matchup_eligible was simply never wired to either clearance path. This
-- backfills it from the fields that already record a real, attributed
-- rights determination -- it does not perform a new review and does not
-- touch any row still under rights_hold (member uploads pending review, per
-- Bill's 2026-09-02 policy: content-collected Gehrig photos are cleared on
-- collection, member uploads require review before use).
--
-- Only rows still at the default 0 (never reviewed for matchup use) are
-- touched. Rows already explicitly excluded (-1, e.g. 0051's photo 519 or a
-- #2519 broken-image purge) are left alone.

PRAGMA foreign_keys = ON;

UPDATE photos
SET is_matchup_eligible = 1
WHERE is_matchup_eligible = 0
  AND rights_hold = 0
  AND publication_eligible = 1;
