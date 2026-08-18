// #3552/#3553: propagates an already-recorded rights clearance from
// media_assets (set by the reviewed Path B content-collection pipeline --
// see rights_evidence) onto the legacy `photos` table.
//
// The B2 -> D1 incremental sync (scripts/b2_d1_incremental_sync.sh) inserts
// new `photos` rows using the column defaults (rights_hold = 1,
// publication_eligible = 0), even when the same file already has a real,
// human-reviewed clearance recorded in media_assets from the Path B
// pipeline (content review -> rights_evidence -> media_assets.rights_hold
// cleared -> B2 ingestion). This closes that gap without ever inventing a
// new decision: it only copies forward a decision a human (recorded via
// rights_evidence, surfaced in media_assets.rights_hold_reason) already
// made, matched by the identical B2 object key
// (media_assets.b2_key = photos.photo_id).
//
// Idempotent: only touches photos rows still held (rights_hold = 1) with a
// matching cleared media_assets row, so re-running (e.g. on every daily
// sync) is always safe and a no-op once a row has been reconciled.

export const RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL = `
UPDATE photos
SET rights_hold = 0,
    publication_eligible = 1,
    rights_status = 'permission_granted',
    reviewed_by = COALESCE(
      (SELECT TRIM(SUBSTR(ma.rights_hold_reason, INSTR(ma.rights_hold_reason, 'reviewer:') + 9))
       FROM media_assets ma
       WHERE ma.b2_key = photos.photo_id
         AND ma.rights_hold = 0
         AND ma.rights_hold_reason LIKE '%reviewer:%'),
      'see_media_assets_rights_hold_reason'
    ),
    reviewed_at = COALESCE(photos.reviewed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    rights_hold_reason = (
      SELECT ma.rights_hold_reason
      FROM media_assets ma
      WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
    ),
    rights_hold_set_at = COALESCE(photos.rights_hold_set_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
WHERE photos.rights_hold = 1
  AND EXISTS (
    SELECT 1 FROM media_assets ma
    WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
  )
`.trim();
