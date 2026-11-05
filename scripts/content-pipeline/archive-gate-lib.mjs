// #5053 -- glue between the archive ingest and the quality gate (functions/_lib/content-quality-gate.ts).
// Pure: it builds the gate's input from a row and a source record, and the D1 update from a verdict.
// The ingest script calls evaluateQuality itself, so this file imports no TypeScript and is unit-tested.

/** Recorded on every release. The release is Product Authority's direction, not a person's rights release. */
export const RELEASE_BASIS =
  "Product Authority direction 2026-10-31 (#5038, #5053): quality-gate release for edition use; not a person's rights release";

/**
 * #5088: Product Authority paused the 2026-10-31 direction on 2026-11-05 (counsel's guidance and the
 * CMG, MLB and Yankees responses are pending). While true, a `good` verdict is recorded but nothing
 * is released for edition use. Lifting the pause is one reviewed change to this constant, after
 * Product Authority lifts it on #5088.
 */
export const EDITION_RELEASE_PAUSED = true;

/** Items Product Authority said to keep although the text does not name Gehrig. */
export const MANUAL_KEEP_CANDIDATE_IDS = ['lgfc-gehrig-2026-1793621199065'];

/**
 * Collectors write "Discovered via <source> search for "<query>"." into summary and provenance notes.
 * That sentence repeats the search query, so it must never reach the gate: a query that names Gehrig
 * would make every result look like it names Gehrig.
 */
export function stripDiscoveryBoilerplate(value) {
  return String(value ?? '')
    // A sentence ends at a period followed by space or the end; "loc.gov" has a period inside it.
    .replace(/Discovered via .*? search for "[^"]*"\.(?=\s|$)/gi, ' ')
    .replace(/Discovered via .*?\.(?=\s|$)/gi, ' ')
    .trim();
}

function textParts(parts) {
  return (parts ?? [])
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part) => part !== null && part !== undefined)
    .map((part) => stripDiscoveryBoilerplate(typeof part === 'string' ? part : JSON.stringify(part)))
    .filter(Boolean);
}

/**
 * The quality gate's input for one row. `text` is the source record's own descriptive text.
 * @returns {{ title: string, text: string[], widthPx: number | null, heightPx: number | null, kind: 'photograph' | 'newspaper', feeRequired: boolean, isDuplicate: boolean, manualKeep: boolean }}
 */
export function gateInputForRow(row, { widthPx, heightPx, kind, text } = {}) {
  return {
    title: stripDiscoveryBoilerplate(row.title),
    text: textParts(text),
    widthPx: widthPx ?? null,
    heightPx: heightPx ?? null,
    kind: kind === 'newspaper' ? 'newspaper' : 'photograph',
    feeRequired: Number(row.fee_required) === 1,
    isDuplicate: false,
    manualKeep: Number(row.gate_manual_keep) === 1 || MANUAL_KEEP_CANDIDATE_IDS.includes(row.candidate_id),
  };
}

/**
 * The columns to write for a verdict. Only a `good` verdict carries a release, and none does while
 * the release is paused (#5088); the verdict itself is always recorded.
 */
export function gateRecord(verdict, nowIso, { releasePaused = EDITION_RELEASE_PAUSED } = {}) {
  const release = verdict.decision === 'good' && !releasePaused;
  return {
    gate_decision: verdict.decision,
    gate_relevance: verdict.relevance,
    gate_reasons: verdict.reasons.join(','),
    gate_evaluated_at: nowIso,
    released_for_editions_at: release ? nowIso : null,
    release_basis: release ? RELEASE_BASIS : null,
  };
}

export function buildGateUpdate(rowId, record) {
  return {
    sql: `UPDATE content_items
          SET gate_decision = ?, gate_relevance = ?, gate_reasons = ?, gate_evaluated_at = ?,
              released_for_editions_at = ?, release_basis = ?
          WHERE id = ?`,
    params: [
      record.gate_decision,
      record.gate_relevance,
      record.gate_reasons,
      record.gate_evaluated_at,
      record.released_for_editions_at,
      record.release_basis,
      rowId,
    ],
  };
}

/** Already archived pictures the gate has not looked at yet. */
export function buildUnevaluatedArchivedSql() {
  return `SELECT ci.id, ci.candidate_id, ci.title, ci.source_url, ci.source_domain, ci.summary, ci.provenance_notes,
                 ci.gate_manual_keep, ma.width_px, ma.height_px, ma.quality_tier,
                 CASE WHEN ci.outcome_basis = 'fee_required' OR EXISTS (
                        SELECT 1 FROM rights_evidence re
                        WHERE re.content_item_id = ci.id AND (re.fee_required = 1 OR re.usage_basis = 'fee_required')
                      ) THEN 1 ELSE 0 END AS fee_required
          FROM content_items ci
          JOIN media_assets ma ON (ci.media_asset_id LIKE 'b2://%' AND ma.b2_key = substr(ci.media_asset_id, 6))
                               OR (ci.media_asset_id LIKE 'media_uid:%' AND ma.media_uid = substr(ci.media_asset_id, 11))
          WHERE ci.deleted_at IS NULL AND ci.superseded_at IS NULL AND ci.gate_decision IS NULL
          ORDER BY ci.id LIMIT ?`;
}

/** One summary line per verdict, for the run log. */
export function summarizeVerdicts(verdicts) {
  const counts = { good: 0, needs_review: 0, not_good: 0 };
  const reasons = {};
  for (const verdict of verdicts) {
    counts[verdict.decision] += 1;
    if (verdict.decision !== 'good') for (const reason of verdict.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return { counts, reasons };
}

/**
 * "Unchecked in" (Product Authority, 2026-11-04): a search result that was brought in quickly as metadata and
 * has no quality-gate verdict yet. The evaluation checks it in (good) or holds it. Counted by gate state, so
 * no extra column is needed.
 */
export function buildUncheckedInCountSql() {
  return `SELECT COUNT(*) AS unchecked_in,
                 SUM(CASE WHEN media_asset_id IS NULL THEN 1 ELSE 0 END) AS not_yet_archived,
                 SUM(CASE WHEN media_asset_id IS NOT NULL THEN 1 ELSE 0 END) AS archived
          FROM content_items
          WHERE content_type = 'photo' AND deleted_at IS NULL AND superseded_at IS NULL AND gate_decision IS NULL`;
}
