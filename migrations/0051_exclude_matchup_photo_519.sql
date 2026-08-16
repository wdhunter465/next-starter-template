-- 0051_exclude_matchup_photo_519.sql
-- Product Authority exclusion for #3536:
-- Prevent D1 photo id 519 / IMG_5715.jpeg (current Weekly Photo Matchup Picture A)
-- from appearing in future homepage Weekly Photo Matchups.
-- Preserve the D1 row and B2 object.

UPDATE photos
SET
  is_matchup_eligible = -1,
  rights_notes = CASE
    WHEN rights_notes IS NULL OR TRIM(rights_notes) = ''
      THEN 'MATCHUP_EXCLUDED: Product Authority; retain D1 row and B2 object (#3536, 2026-08-16)'
    ELSE rights_notes || ' | MATCHUP_EXCLUDED: Product Authority; retain D1 row and B2 object (#3536, 2026-08-16)'
  END
WHERE id = 519
  AND photo_id = 'IMG_5715.jpeg'
  AND is_matchup_eligible >= 0;
