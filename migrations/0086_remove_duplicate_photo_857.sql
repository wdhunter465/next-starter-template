-- 0086_remove_duplicate_photo_857.sql
-- Product Authority direction for #4705 (2026-10-19): D1 photo id 857
-- (LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg) is the same image as
-- photo id 855 (LGFC_sha256_1366508701ac474296341b1ca8d8aa92bb1be135.jpg). Take 857
-- off the site and out of the Weekly Matchup pool. Photo 855 stays.
--
-- The photos row is kept, not deleted: closed matchups 12, 16 and 18 reference it. The
-- media_assets row is kept so a future upload of the same picture is still flagged by the
-- perceptual-hash check. The B2 object is deleted separately, after this is applied and
-- /api/photos/get?id=857 returns nothing (#4705).

UPDATE photos
SET
  publication_eligible = 0,
  is_matchup_eligible = -1,
  rights_notes = CASE
    WHEN rights_notes IS NULL OR TRIM(rights_notes) = ''
      THEN 'DUPLICATE_REMOVED: duplicate of photo 855; Product Authority; retain D1 row for closed matchups (#4705, 2026-10-19)'
    ELSE rights_notes || ' | DUPLICATE_REMOVED: duplicate of photo 855; Product Authority; retain D1 row for closed matchups (#4705, 2026-10-19)'
  END
WHERE id = 857
  AND photo_id = 'LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg'
  AND (publication_eligible <> 0 OR is_matchup_eligible >= 0);
