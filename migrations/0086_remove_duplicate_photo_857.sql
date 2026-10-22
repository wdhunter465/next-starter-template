-- 0086_remove_duplicate_photo_857.sql
-- Product Authority direction for #4705 (2026-10-19): D1 photo id 857
-- (LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg) is the same image as
-- photo id 855 (LGFC_sha256_1366508701ac474296341b1ca8d8aa92bb1be135.jpg). Remove 857
-- from the site and the Weekly Matchup pool. Photo 855 stays. The B2 object for 857 is
-- already deleted.
--
-- Step 1 hides the row, so the site is clean even if step 2 does not run.
-- Step 2 deletes the row only when no story uses it: content_inventory_media has a
-- RESTRICT foreign key to photos(id), and a blocked delete must not stop the migration.
-- weekly_matchups has no foreign key to photos. Closed matchups 12, 16 and 18 keep their
-- photo ids, and the results page already leaves out a winner photo that cannot load.
-- The media_assets row is kept so a future upload of the same picture is still flagged
-- by the perceptual-hash check.

UPDATE photos
SET
  publication_eligible = 0,
  is_matchup_eligible = -1,
  rights_notes = CASE
    WHEN rights_notes IS NULL OR TRIM(rights_notes) = ''
      THEN 'DUPLICATE_REMOVED: duplicate of photo 855; Product Authority (#4705, 2026-10-19)'
    ELSE rights_notes || ' | DUPLICATE_REMOVED: duplicate of photo 855; Product Authority (#4705, 2026-10-19)'
  END
WHERE id = 857
  AND photo_id = 'LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg'
  AND (publication_eligible <> 0 OR is_matchup_eligible >= 0);

DELETE FROM photos
WHERE id = 857
  AND photo_id = 'LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg'
  AND NOT EXISTS (SELECT 1 FROM content_inventory_media WHERE media_id = 857);
