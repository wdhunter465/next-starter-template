// Admin API request parsing/validation for #3551/#3552 rights evidence (migration 0055).

import { CANDIDATE_ID_PATTERN, CANDIDATE_ID_VALIDATION_MESSAGE } from './content-pipeline-candidate-constants';
import {
  RIGHTS_EVIDENCE_CHANNEL_SET,
  RIGHTS_EVIDENCE_CONCLUSION_SET,
  RIGHTS_EVIDENCE_TYPE_SET,
  RIGHTS_EVIDENCE_USAGE_DECISIONS,
  type RightsEvidenceChannel,
  type RightsEvidenceConclusion,
  type RightsEvidenceType,
  type RightsEvidenceUsageDecision,
} from './rights-evidence-repository';

const RIGHTS_EVIDENCE_USAGE_DECISION_SET = new Set<string>(RIGHTS_EVIDENCE_USAGE_DECISIONS);

export { CANDIDATE_ID_PATTERN, CANDIDATE_ID_VALIDATION_MESSAGE };

const EVIDENCE_TEXT_MAX_LENGTH = 8000;
const EVIDENCE_URL_MAX_LENGTH = 2048;
const CONCLUSION_RATIONALE_MAX_LENGTH = 4000;
const RIGHTS_HOLDER_MAX_LENGTH = 500;
const REPOSITORY_OR_COLLECTION_MAX_LENGTH = 500;
const PUBLICATION_DATE_SOURCE_MAX_LENGTH = 500;
const SOURCE_FILENAME_MAX_LENGTH = 500;
const TAGGING_REQUIREMENTS_MAX_LENGTH = 2000;

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
  channel?: RightsEvidenceChannel;
  rights_holder?: string;
  repository_or_collection?: string;
  publication_established?: 0 | 1;
  us_publication_or_uraa_confirmed?: 0 | 1;
  publication_date_source?: string;
  source_filename?: string;
  tagging_requirements?: string;
  usage_decision?: RightsEvidenceUsageDecision;
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

// Accepts true/false/0/1 (and their string forms) and normalizes to 0/1.
// Returns undefined for anything else, including missing values.
function asBooleanishFlag(value: unknown): 0 | 1 | undefined {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return undefined;
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

  // #3551's 2026-08-18 directive: no blanket approval. A conclusion is only
  // ever authoritative for the specific channel it was recorded against, so
  // that channel must be present whenever a conclusion is recorded.
  let channel: RightsEvidenceChannel | undefined;
  if (conclusion !== undefined) {
    const rawChannel = asTrimmedString(record.channel);
    if (!rawChannel || !RIGHTS_EVIDENCE_CHANNEL_SET.has(rawChannel)) {
      return {
        ok: false,
        error: `channel is required when recording a conclusion and must be one of: ${[...RIGHTS_EVIDENCE_CHANNEL_SET].join(', ')}.`,
      };
    }
    channel = rawChannel as RightsEvidenceChannel;
  } else if (record.channel !== undefined && record.channel !== null) {
    const rawChannel = asTrimmedString(record.channel);
    if (rawChannel && RIGHTS_EVIDENCE_CHANNEL_SET.has(rawChannel)) {
      channel = rawChannel as RightsEvidenceChannel;
    }
  }

  // Evidence can carry a rights holder / source repository without a
  // conclusion yet -- these are not conclusion-gated.
  const rightsHolder = asOptionalTrimmedString(record.rights_holder, RIGHTS_HOLDER_MAX_LENGTH);
  const repositoryOrCollection = asOptionalTrimmedString(
    record.repository_or_collection,
    REPOSITORY_OR_COLLECTION_MAX_LENGTH,
  );

  // pre_1931_publication evidence must carry its full structured basis --
  // partial evidence for this evidence_type is not accepted.
  let publicationEstablished: 0 | 1 | undefined;
  let usPublicationOrUraaConfirmed: 0 | 1 | undefined;
  let publicationDateSource: string | undefined;
  if (evidenceType === 'pre_1931_publication') {
    publicationEstablished = asBooleanishFlag(record.publication_established);
    usPublicationOrUraaConfirmed = asBooleanishFlag(record.us_publication_or_uraa_confirmed);
    publicationDateSource = asOptionalTrimmedString(
      record.publication_date_source,
      PUBLICATION_DATE_SOURCE_MAX_LENGTH,
    );

    const missing: string[] = [];
    if (publicationEstablished === undefined) missing.push('publication_established');
    if (usPublicationOrUraaConfirmed === undefined) missing.push('us_publication_or_uraa_confirmed');
    if (!publicationDateSource) missing.push('publication_date_source');

    if (missing.length > 0) {
      return {
        ok: false,
        error: `pre_1931_publication evidence requires: ${missing.join(', ')}.`,
      };
    }
  }

  // #3552 phase 5 (#3748): the per-photo permit/deny/hold triage flag.
  // Omitted entirely means the repository's own default ('hold') applies --
  // this parser never guesses a decision on the caller's behalf.
  let usageDecision: RightsEvidenceUsageDecision | undefined;
  if (record.usage_decision !== undefined && record.usage_decision !== null) {
    const rawUsageDecision = asTrimmedString(record.usage_decision);
    if (!rawUsageDecision || !RIGHTS_EVIDENCE_USAGE_DECISION_SET.has(rawUsageDecision)) {
      return {
        ok: false,
        error: `usage_decision must be one of: ${[...RIGHTS_EVIDENCE_USAGE_DECISION_SET].join(', ')}.`,
      };
    }
    usageDecision = rawUsageDecision as RightsEvidenceUsageDecision;
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
    channel,
    rights_holder: rightsHolder,
    repository_or_collection: repositoryOrCollection,
    publication_established: publicationEstablished,
    us_publication_or_uraa_confirmed: usPublicationOrUraaConfirmed,
    publication_date_source: publicationDateSource,
    source_filename: asOptionalTrimmedString(record.source_filename, SOURCE_FILENAME_MAX_LENGTH),
    tagging_requirements: asOptionalTrimmedString(record.tagging_requirements, TAGGING_REQUIREMENTS_MAX_LENGTH),
    usage_decision: usageDecision,
  };

  return { ok: true, request };
}

export function isValidCandidateId(candidateId: string): boolean {
  return CANDIDATE_ID_PATTERN.test(candidateId);
}
