// #3552 phase 3: one-time backfill for rights_evidence rows written by the
// pre-fix batch-approval writer (see content-pipeline-batch-rights-approval.ts),
// which left rights_holder/repository_or_collection NULL and stored a
// synthesized evidence_text sentence instead of the source's raw license
// string. This derives the same corrected values the fixed writer would
// have written (via the same deriveCommonsProvenance helper, so the two can
// never drift apart), and applies them only to rows that still show the old
// gap (rights_holder IS NULL) -- so it is safe to re-run and never
// overwrites a row a human has since edited.

import { deriveCommonsProvenance, type CommonsLicenseNote } from './content-pipeline-license-conclusion-mapping';

export type BackfillCandidate = {
  candidate_id: string;
};

export type RightsEvidenceProvenanceBackfillRow = {
  candidateId: string;
  evidenceText: string;
  rightsHolder: string | null;
  update: string;
};

const REPOSITORY_OR_COLLECTION = 'Wikimedia Commons';

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildRightsEvidenceProvenanceBackfillRow(
  candidate: BackfillCandidate,
  licenseNote: CommonsLicenseNote | undefined,
): RightsEvidenceProvenanceBackfillRow {
  if (!licenseNote) {
    throw new Error(`No license note found for candidate_id ${candidate.candidate_id}`);
  }

  const { evidenceText, rightsHolder } = deriveCommonsProvenance(licenseNote);

  const update = `UPDATE rights_evidence
SET evidence_text = ${sqlString(evidenceText)},
    rights_holder = ${sqlString(rightsHolder)},
    repository_or_collection = ${sqlString(REPOSITORY_OR_COLLECTION)}
WHERE rights_holder IS NULL
  AND content_item_id = (SELECT id FROM content_items WHERE candidate_id = ${sqlString(candidate.candidate_id)});`;

  return { candidateId: candidate.candidate_id, evidenceText, rightsHolder, update };
}

export function buildRightsEvidenceProvenanceBackfillSql(
  candidates: BackfillCandidate[],
  licenseNotesByCandidateId: Map<string, CommonsLicenseNote>,
): { rows: RightsEvidenceProvenanceBackfillRow[]; sqlBatch: string } {
  const rows = candidates.map((candidate) =>
    buildRightsEvidenceProvenanceBackfillRow(candidate, licenseNotesByCandidateId.get(candidate.candidate_id)),
  );
  const sqlBatch = rows.map((row) => row.update).join('\n\n');
  return { rows, sqlBatch };
}
