// #3552: builds the rights_evidence + curator_decision SQL for a batch of
// already-imported content_items, given a candidates registry, its matching
// license-notes companion data, and a human reviewer name. This never
// decides *whether* an item is approved -- that determination (and the
// reviewer identity) is supplied by the caller. It only classifies each
// item's license template into the fixed rights_evidence.conclusion
// vocabulary via mapLicenseToConclusion, which refuses to guess for
// anything it doesn't recognize.

import {
  deriveCommonsProvenance,
  mapConclusionToRightsStatus,
  mapLicenseToConclusion,
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
  conclusion: string;
  evidenceInsert: string;
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

  const conclusion = mapLicenseToConclusion(licenseNote.license_short_name);
  const rightsStatus = mapConclusionToRightsStatus(conclusion);
  const { evidenceText, rightsHolder } = deriveCommonsProvenance(licenseNote);

  const rationale =
    conclusion === 'permission_granted'
      ? `${reviewer} reviewed Wikimedia Commons' own license/attribution/caption data for this item and approved it for use on the LGFC website. License is a conditioned grant (attribution required) rather than an unconditional public-domain claim; credit_line carries the required attribution.`
      : `${reviewer} reviewed Wikimedia Commons' own license/attribution/caption data for this item and approved it for use on the LGFC website.`;

  const evidenceInsert = `INSERT INTO rights_evidence (
  content_item_id, evidence_type, evidence_text, evidence_url, evidence_metadata,
  rights_holder, repository_or_collection,
  reviewer, conclusion, conclusion_rationale
)
SELECT id, 'commons_license', ${sqlString(evidenceText)}, ${sqlString(licenseNote.license_url)}, ${sqlJson(licenseNote)},
  ${sqlString(rightsHolder)}, ${sqlString(REPOSITORY_OR_COLLECTION)},
  ${sqlString(reviewer)}, ${sqlString(conclusion)}, ${sqlString(rationale)}
FROM content_items WHERE candidate_id = ${sqlString(candidate.candidate_id)};`;

  const decisionUpdate = `UPDATE content_items
SET curator_decision = 'approved',
    curator_decision_by = ${sqlString(reviewer)},
    curator_decision_at = ${sqlString(nowIso)},
    curator_decision_notes = ${sqlString('Approved after reviewing real Wikimedia Commons license/caption/credit data for this item.')},
    rights_status = ${sqlString(rightsStatus)},
    updated_at = ${sqlString(nowIso)}
WHERE candidate_id = ${sqlString(candidate.candidate_id)};`;

  return { candidateId: candidate.candidate_id, conclusion, evidenceInsert, decisionUpdate };
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
  const sqlBatch = rows.map((row) => `${row.evidenceInsert}\n${row.decisionUpdate}`).join('\n\n');
  return { rows, sqlBatch };
}
