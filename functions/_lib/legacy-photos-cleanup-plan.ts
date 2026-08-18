// #3552: the ordered cleanup statements for the one-time legacy-photos reset
// (scripts/ops/clear-legacy-photos-and-dependents.mjs). Order matters:
// content_inventory_media.media_id has `FOREIGN KEY ... REFERENCES
// photos(id) ON DELETE RESTRICT` (migration 0038), so it must be cleared
// before photos or the DELETE FROM photos statement is rejected outright.
// weekly_matchups/weekly_votes and milestones.photo_id aren't FK-enforced,
// but are cleared/nulled alongside so they don't silently point at photo
// IDs that no longer exist.

export const LEGACY_PHOTOS_CLEANUP_STATEMENTS: string[] = [
  'DELETE FROM content_inventory_media',
  'DELETE FROM weekly_votes',
  'DELETE FROM weekly_matchups',
  'UPDATE milestones SET photo_id = NULL WHERE photo_id IS NOT NULL',
  'DELETE FROM photos',
];
