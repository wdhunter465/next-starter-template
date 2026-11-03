-- 0090_hold_pilot_photos_5064.sql
-- #5064, Product Authority Go 2026-11-03: hold the four Club Home pilot photos (9401-9404).
--
-- They were seeded by the pilot pack (#4180) with rights_hold = 0, publication_eligible = 1 and
-- rights_status = 'public_domain_candidate' (source: Wikimedia Commons), and no per-item review is
-- recorded for them. Setting rights_hold = 1 stops every surface that uses rightsClearedClause()
-- (public photo list, Club Home media, matchup pool) from serving them until each has a reviewed
-- rights_evidence row and a person clears the hold again.
--
-- Touches only these four rows, guarded by id AND photo_id, and only while they are still cleared,
-- so running it twice changes nothing and a differently-held row is never overwritten. The photos
-- are kept (no delete) and their rights_status stays 'public_domain_candidate'.

UPDATE photos
SET rights_hold = 1,
    rights_hold_reason = 'pilot_photos_held_pending_rights_review_2026_11_03',
    rights_hold_set_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    rights_notes = CASE
      WHEN rights_notes IS NULL OR TRIM(rights_notes) = ''
        THEN 'HELD: Club Home pilot photo with no recorded rights review; Product Authority (#5064, 2026-11-03)'
      ELSE rights_notes || ' | HELD: Club Home pilot photo with no recorded rights review; Product Authority (#5064, 2026-11-03)'
    END
WHERE rights_hold = 0
  AND (
       (id = 9401 AND photo_id = 'lgfc-clubhome-pilot-gehrig-1925')
    OR (id = 9402 AND photo_id = 'lgfc-clubhome-pilot-gehrig-1923-new-yankee')
    OR (id = 9403 AND photo_id = 'lgfc-clubhome-pilot-gehrig-1934-goudey')
    OR (id = 9404 AND photo_id = 'lgfc-clubhome-pilot-gehrig-columbia')
  );
