// #3552 existing-content quarantine: shared SQL fragment for excluding any
// `photos` or `media_assets` row that has not been explicitly cleared by a
// rights reviewer. New rows default to held (rights_hold = 1) until cleared,
// so omitting this filter is the only way accidentally to leak unreviewed
// media -- callers that read photos for public or member-facing display must
// include it.

export function rightsClearedClause(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  // #3553: publication_eligible is the Issue-specified public-display gate.
  // Keep rights_hold in the same predicate so a row cannot leak if the two
  // flags ever drift.
  return `${prefix}rights_hold = 0 AND ${prefix}publication_eligible = 1`;
}
