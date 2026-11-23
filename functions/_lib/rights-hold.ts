// #5467 (Product Authority decision, 2026-11-23): every B2 photo is used on the
// website and in social posts, whether or not a rights review is recorded, to
// stress-test the design before the January 2027 launch. This is the single
// public-display gate for `photos` rows (and the `media_assets` rows the
// reconcile job copies from).
//
// What stays out: a photo whose rights_status is 'blocked' or
// 'copyright_restricted' (a rights holder denied or revoked, or asked for
// removal). Setting a photo to 'blocked' removes it from every surface that
// calls this function at once. rights_hold and publication_eligible are still
// recorded for review history but no longer decide public display.
//
// Replaces the #3552 / #3553 predicate `rights_hold = 0 AND publication_eligible = 1`.
// Callers that read photos for public or member-facing display must keep
// including this fragment; omitting it would also leak removed photos.

export const PUBLICLY_EXCLUDED_RIGHTS_STATUSES = ["blocked", "copyright_restricted"] as const;

export function rightsClearedClause(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  const excluded = PUBLICLY_EXCLUDED_RIGHTS_STATUSES.map((s) => `'${s}'`).join(", ");
  return `COALESCE(${prefix}rights_status, 'unreviewed') NOT IN (${excluded})`;
}
