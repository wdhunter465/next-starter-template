-- 0052_restore_matchup_picture_b_3538.sql
-- Product Authority recovery for #3538 (follow-on to #3536):
-- After excluding photo 519, self-heal selected pair A=697 / B=3.
-- Photo 3's B2 object is HTTP 404, so Picture B does not render.
-- Keep A=697; replace B with an eligible reachable candidate; soft-exclude id 3.

-- 1) Soft-exclude the missing B2 object (id 3 / IMG_0254.jpeg).
UPDATE photos
SET
  is_matchup_eligible = -1,
  rights_notes = CASE
    WHEN rights_notes IS NULL OR TRIM(rights_notes) = ''
      THEN 'PURGE_ELIGIBLE: B2 object missing (HTTP 404); OK to remove (#3538, 2026-08-16)'
    ELSE rights_notes || ' | PURGE_ELIGIBLE: B2 object missing (HTTP 404); OK to remove (#3538, 2026-08-16)'
  END
WHERE id = 3
  AND is_matchup_eligible >= 0;

-- 2) Keep Picture A = 697; assign a new eligible Picture B (not 697/519/3).
UPDATE weekly_matchups
SET
  photo_b_id = (
    SELECT p.id
    FROM photos p
    WHERE p.url IS NOT NULL
      AND TRIM(p.url) != ''
      AND p.is_matchup_eligible >= 0
      AND COALESCE(p.is_memorabilia, 0) = 0
      AND p.id NOT IN (697, 519, 3)
    ORDER BY RANDOM()
    LIMIT 1
  ),
  status = 'active'
WHERE id = 9
  AND week_start = '2026-08-10'
  AND photo_a_id = 697
  AND EXISTS (
    SELECT 1
    FROM photos p
    WHERE p.url IS NOT NULL
      AND TRIM(p.url) != ''
      AND p.is_matchup_eligible >= 0
      AND COALESCE(p.is_memorabilia, 0) = 0
      AND p.id NOT IN (697, 519, 3)
  );

-- 3) Pair change resets votes for the week (0-0). Vote restore is impossible.
DELETE FROM weekly_votes
WHERE week_start = '2026-08-10';
