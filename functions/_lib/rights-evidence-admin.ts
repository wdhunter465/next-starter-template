// Admin API request parsing/validation for #3551/#3552 rights evidence (migration 0055).

import { CANDIDATE_ID_PATTERN, CANDIDATE_ID_VALIDATION_MESSAGE } from './content-pipeline-candidate-constants';
import {
  RIGHTS_EVIDENCE_CONCLUSION_SET,
  RIGHTS_EVIDENCE_TYPE_SET,
  type RightsEvidenceConclusion,
  type RightsEvidenceType,
} from './rights-evidence-repository';

export { CANDIDATE_ID_PATTERN, CANDIDATE_ID_VALIDATION_MESSAGE };

const EVIDENCE_TEXT_MAX_LENGTH = 8000;
const EVIDENCE_URL_MAX_LENGTH = 2048;
const CONCLUSION_RATIONALE_MAX_LENGTH = 4000;

export type RecordRightsEvidenceRequest = {
  candidate_id: string;
  source_domain?: string;
  evidence_type: RightsEvidenceType;
  evidence_text?: string;
  evidence_url?: string;
  evidence_metadata?: Record<string, unknown>;
  reviewer?: string;
  conclusion?: RightsEvidenceConclusion;
  conclusion_rationale?: string;
};

export type ParseRecordRightsEvidenceResult =
  | { ok: true; request: RecordRightsEvidenceRequest }
  | { ok: false; error: string };

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = asTrimmedString(value);
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function parseRecordRightsEvidenceRequest(body: unknown): ParseRecordRightsEvidenceResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const record = body as Record<string, unknown>;

  const candidateId = asTrimmedString(record.candidate_id);
  if (!candidateId || !CANDIDATE_ID_PATTERN.test(candidateId)) {
    return { ok: false, error: CANDIDATE_ID_VALIDATION_MESSAGE };
  }

  const evidenceType = asTrimmedString(record.evidence_type);
  if (!evidenceType || !RIGHTS_EVIDENCE_TYPE_SET.has(evidenceType)) {
    return { ok: false, error: `evidence_type must be one of: ${[...RIGHTS_EVIDENCE_TYPE_SET].join(', ')}.` };
  }

  let conclusion: RightsEvidenceConclusion | undefined;
  if (record.conclusion !== undefined && record.conclusion !== null) {
    const rawConclusion = asTrimmedString(record.conclusion);
    if (!rawConclusion || !RIGHTS_EVIDENCE_CONCLUSION_SET.has(rawConclusion)) {
      return {
        ok: false,
        error: `conclusion must be one of: ${[...RIGHTS_EVIDENCE_CONCLUSION_SET].join(', ')}.`,
      };
    }
    conclusion = rawConclusion as RightsEvidenceConclusion;

    // A conclusion is a reviewer's determination -- it must be attributable and reasoned.
    if (!asTrimmedString(record.reviewer)) {
      return { ok: false, error: 'reviewer is required when recording a conclusion.' };
    }
    if (!asTrimmedString(record.conclusion_rationale)) {
      return { ok: false, error: 'conclusion_rationale is required when recording a conclusion.' };
    }
  }

  let evidenceMetadata: Record<string, unknown> | undefined;
  if (record.evidence_metadata !== undefined && record.evidence_metadata !== null) {
    if (typeof record.evidence_metadata !== 'object' || Array.isArray(record.evidence_metadata)) {
      return { ok: false, error: 'evidence_metadata must be a JSON object.' };
    }
    evidenceMetadata = record.evidence_metadata as Record<string, unknown>;
  }

  const request: RecordRightsEvidenceRequest = {
    candidate_id: candidateId,
    evidence_type: evidenceType as RightsEvidenceType,
    source_domain: asOptionalTrimmedString(record.source_domain, 255),
    evidence_text: asOptionalTrimmedString(record.evidence_text, EVIDENCE_TEXT_MAX_LENGTH),
    evidence_url: asOptionalTrimmedString(record.evidence_url, EVIDENCE_URL_MAX_LENGTH),
    evidence_metadata: evidenceMetadata,
    reviewer: asOptionalTrimmedString(record.reviewer, 255),
    conclusion,
    conclusion_rationale: asOptionalTrimmedString(record.conclusion_rationale, CONCLUSION_RATIONALE_MAX_LENGTH),
  };

  return { ok: true, request };
}

export function isValidCandidateId(candidateId: string): boolean {
  return CANDIDATE_ID_PATTERN.test(candidateId);
}
