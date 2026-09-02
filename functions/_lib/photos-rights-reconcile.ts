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
//
// Also flips is_matchup_eligible to APPROVED (1) in the same statement
// (#3551 "leverage the new D1 table to provide content to the weekly
// matchups"): Weekly Matchup (functions/api/matchup/current.ts) reads
// is_matchup_eligible, not rights_hold/publication_eligible directly, and
// nothing else ever set it -- a content-collection rights approval landed
// on `photos` but stayed permanently invisible to Weekly Matchup. Only
// touches rows still at the unreviewed default (0); an explicit exclusion
// (-1, e.g. migrations/0051, a #2519 broken-image purge) is never
// overridden by a rights reconciliation.

// media_assets.b2_key is indexed but NOT unique (migrations/0010_media_assets.sql),
// so every correlated lookup below pins to a single deterministic row via
// "ORDER BY ma.id DESC LIMIT 1" -- without it, a duplicate b2_key (e.g. a key
// re-ingested under a second media_uid) would make these scalar subqueries
// return more than one row, which SQLite raises as a runtime error and would
// break the whole daily sync job, not just this one photos row.
//
// reviewed_at / rights_hold_set_at are both taken from the matched
// media_assets row's own rights_hold_set_at -- the real timestamp of when
// that decision was recorded (commitIngestedMedia sets it at commit time,
// i.e. when the already-reviewed conclusion was acted on) -- rather than
// "now" (the time this reconciliation happens to run, which would make an
// old, already-reviewed decision look like it was just made).
export const RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL = `
UPDATE photos
SET rights_hold = 0,
    publication_eligible = 1,
    is_matchup_eligible = CASE WHEN photos.is_matchup_eligible = 0 THEN 1 ELSE photos.is_matchup_eligible END,
    rights_status = 'permission_granted',
    reviewed_by = COALESCE(
      (SELECT TRIM(SUBSTR(ma.rights_hold_reason, INSTR(ma.rights_hold_reason, 'reviewer:') + 9))
       FROM media_assets ma
       WHERE ma.b2_key = photos.photo_id
         AND ma.rights_hold = 0
         AND ma.rights_hold_reason LIKE '%reviewer:%'
       ORDER BY ma.id DESC LIMIT 1),
      'see_media_assets_rights_hold_reason'
    ),
    reviewed_at = COALESCE(
      photos.reviewed_at,
      (SELECT ma.rights_hold_set_at FROM media_assets ma
       WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
       ORDER BY ma.id DESC LIMIT 1),
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    rights_hold_reason = (
      SELECT ma.rights_hold_reason
      FROM media_assets ma
      WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
      ORDER BY ma.id DESC LIMIT 1
    ),
    rights_hold_set_at = COALESCE(
      (SELECT ma.rights_hold_set_at FROM media_assets ma
       WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
       ORDER BY ma.id DESC LIMIT 1),
      photos.rights_hold_set_at,
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
WHERE photos.rights_hold = 1
  AND EXISTS (
    SELECT 1 FROM media_assets ma
    WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
  )
`.trim();
