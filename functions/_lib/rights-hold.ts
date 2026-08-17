// #3552 existing-content quarantine: shared SQL fragment for excluding any
// `photos` or `media_assets` row that has not been explicitly cleared by a
// rights reviewer. New rows default to held (rights_hold = 1) until cleared,
// so omitting this filter is the only way accidentally to leak unreviewed
// media -- callers that read photos for public or member-facing display must
// include it.

export const RIGHTS_HOLD_LEGACY_REASON = "legacy_content_pending_rights_review_2026_08_17";

export function rightsClearedClause(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}rights_hold = 0`;
}
