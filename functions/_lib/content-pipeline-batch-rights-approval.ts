// #3552: builds the rights_evidence + curator_decision SQL for a batch of
// already-imported content_items, given a candidates registry, its matching
// license-notes companion data, and a human reviewer name. This never
// decides *whether* an item is approved -- that determination (and the
// reviewer identity) is supplied by the caller. It only classifies each
// item's license template into the fixed rights_evidence.conclusion
// vocabulary via resolveCommonsUsageDecision, which never guesses for
// anything it doesn't recognize -- an unrecognized item is queued as
// usage_decision='hold' (#3552 phase 5 / #3748) rather than aborting the
// whole batch the way the underlying mapLicenseToConclusion still does for
// callers that want that stricter behavior.

import {
  deriveCommonsProvenance,
  deriveTaggingRequirements,
  mapConclusionToRightsStatus,
  resolveCommonsUsageDecision,
} from './content-pipeline-license-conclusion-mapping';

export type LicenseNote = {
  candidate_id: string;
  license_short_name: string | null;
  license_url?: string | null;
  usage_terms?: string | null;
  artist?: string | null;
  [key: string]: unknown;
};

// This writer is Commons-specific (evidence_type is hardcoded to
// 'commons_license' below); repository_or_collection records that fact on
// every row it writes rather than leaving it for a reader to infer from
// evidence_type's fixed vocabulary.
const REPOSITORY_OR_COLLECTION = 'Wikimedia Commons';

export type CandidateForApproval = {
  candidate_id: string;
  source_metadata?: { date_accessed?: string } | null;
};

export type BatchRightsApprovalRow = {
  candidateId: string;
  usageDecision: string;
  // null when usageDecision is 'hold' -- #3552 phase 5 (#3748), no
  // conclusion is recorded until a human resolves the hold.
  conclusion: string | null;
  evidenceInsert: string;
  // '' when usageDecision is 'hold' -- nothing to run, curator_decision
  // stays whatever it already was rather than being marked approved.
  decisionUpdate: string;
};

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value ?? {}));
}

export function buildBatchRightsApprovalRow(
  candidate: CandidateForApproval,
  licenseNote: LicenseNote | undefined,
  reviewer: string,
  nowIso: string,
): BatchRightsApprovalRow {
  if (!licenseNote) {
    throw new Error(`No license note found for candidate_id ${candidate.candidate_id}`);
  }

  const { usageDecision, conclusion } = resolveCommonsUsageDecision(licenseNote.license_short_name);
  const { evidenceText, rightsHolder } = deriveCommonsProvenance(licenseNote);
  const taggingRequirements = deriveTaggingRequirements(licenseNote.license_short_name, licenseNote.artist);

  const rationale =
    conclusion === 'permission_granted'
      ? `${reviewer} reviewed Wikimedia Commons' own license/attribution/caption data for this item and approved it for use on the LGFC website. License is a conditioned grant (attribution required) rather than an unconditional public-domain claim; credit_line carries the required attribution.`
      : conclusion === 'public_domain_confirmed'
        ? `${reviewer} reviewed Wikimedia Commons' own license/attribution/caption data for this item and approved it for use on the LGFC website.`
        : // usageDecision === 'hold': license text wasn't recognized -- captured
          // as evidence for a human to resolve, not guessed at.
          `${reviewer}'s batch review did not recognize this item's license template ("${licenseNote.license_short_name}") against the known Commons vocabulary -- held for individual review rather than guessed at.`;

  const evidenceInsert = `INSERT INTO rights_evidence (
  content_item_id, evidence_type, evidence_text, evidence_url, evidence_metadata,
  rights_holder, repository_or_collection,
  reviewer, conclusion, conclusion_rationale,
  source_filename, tagging_requirements, usage_decision
)
SELECT id, 'commons_license', ${sqlString(evidenceText)}, ${sqlString(licenseNote.license_url)}, ${sqlJson(licenseNote)},
  ${sqlString(rightsHolder)}, ${sqlString(REPOSITORY_OR_COLLECTION)},
  ${sqlString(reviewer)}, ${sqlString(conclusion)}, ${sqlString(rationale)},
  title, ${sqlString(taggingRequirements)}, ${sqlString(usageDecision)}
FROM content_items WHERE candidate_id = ${sqlString(candidate.candidate_id)};`;

  // A 'hold' item is never marked approved -- leave curator_decision alone
  // for a human to act on once the hold is resolved.
  const decisionUpdate =
    usageDecision === 'hold'
      ? ''
      : `UPDATE content_items
SET curator_decision = 'approved',
    curator_decision_by = ${sqlString(reviewer)},
    curator_decision_at = ${sqlString(nowIso)},
    curator_decision_notes = ${sqlString('Approved after reviewing real Wikimedia Commons license/caption/credit data for this item.')},
    rights_status = ${sqlString(mapConclusionToRightsStatus(conclusion!))},
    updated_at = ${sqlString(nowIso)}
WHERE candidate_id = ${sqlString(candidate.candidate_id)};`;

  return { candidateId: candidate.candidate_id, usageDecision, conclusion, evidenceInsert, decisionUpdate };
}

export function buildBatchRightsApprovalSql(
  candidates: CandidateForApproval[],
  licenseNotesByCandidateId: Map<string, LicenseNote>,
  reviewer: string,
  nowIso: string,
): { rows: BatchRightsApprovalRow[]; sqlBatch: string } {
  const rows = candidates.map((candidate) =>
    buildBatchRightsApprovalRow(candidate, licenseNotesByCandidateId.get(candidate.candidate_id), reviewer, nowIso),
  );
  const sqlBatch = rows
    .map((row) => (row.decisionUpdate ? `${row.evidenceInsert}\n${row.decisionUpdate}` : row.evidenceInsert))
    .join('\n\n');
  return { rows, sqlBatch };
}
