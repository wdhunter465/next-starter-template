// Safe publication-prep view/helper for LGFC content pipeline (#2286 / #2324).
// Admin/internal preparation surface only — no content_inventory writes or public exposure.

import { CANDIDATE_ID_PATTERN, CANDIDATE_ID_VALIDATION_MESSAGE, PUBLICATION_STATUSES, REVIEW_STATUSES } from './content-pipeline-candidate-constants';
import type { StoredCandidate } from './content-pipeline-candidate-repository';
import {
  getCandidateByCandidateId,
  getUploadedMediaReferenceForCandidate,
  listCandidates,
  type CandidateListFilter,
} from './content-pipeline-candidate-repository';
import {
  type AdminMediaReferenceFields,
  requireContentPipelineMediaReferenceTables,
  serializeAdminMediaReferences,
} from './content-pipeline-media-reference';
import { getCurrentConclusionForCandidateChannel, type RightsEvidenceChannel } from './rights-evidence-repository';

export { requireContentPipelineMediaReferenceTables as requireContentPipelinePublicationPrepTables };

const PREP_APPROVED_REVIEW_STATUSES = new Set([
  'approved_internal_reference',
  'approved_public_candidate',
  'approved_citation_reference_only',
]);

const PREP_ACCEPTABLE_RIGHTS_STATUSES = new Set(['permission_granted', 'public_domain_candidate']);

const PREP_ACCEPTABLE_PRIVACY_REVIEW_STATUSES = new Set(['approved', 'not_applicable']);

const PREP_BLOCKED_SOURCE_TRUST_STATUSES = new Set(['blocked', 'deleted']);

const PREP_BLOCKED_RELEVANCE_STATUSES = new Set(['not_relevant', 'pending']);

const PREP_VALID_PUBLICATION_STATUSES = new Set(['draft_candidate', 'staged', 'approved_for_publish']);

export const MEMBER_SUBMISSION_PREP_SOURCE_NAME = 'LGFC Member Submission';

// Maps #3552's 11 fine-grained publication_target values to #3551's 5 coarse
// rights-authorization channels (2026-08-18 Product Authority directive).
export function channelForPublicationTarget(target: string | null): RightsEvidenceChannel | null {
  if (!target) return null;
  switch (target) {
    case 'social':
      return 'social_media';
    case 'newsletter':
      return 'newsletter_email';
    case 'lou_gehrig_day':
      return 'fundraiser_campaign';
    case 'internal_reference_only':
      return 'internal_archive_only';
    case 'biography':
    case 'timeline':
    case 'gallery':
    case 'library':
    case 'memorabilia':
    case 'article':
    case 'homepage_feature':
      return 'website';
    default:
      return null;
  }
}

export type PublicationPrepGateResult = {
  pass: boolean;
  value: string | null;
  requirement: string;
};

export type PublicationPrepEligibility = {
  eligible: boolean;
  reasons: string[];
  gates: {
    review_status: PublicationPrepGateResult;
    rights_status: PublicationPrepGateResult;
    privacy_review_status: PublicationPrepGateResult;
    source_trust_status: PublicationPrepGateResult;
    relevance_status: PublicationPrepGateResult;
    publication_status: PublicationPrepGateResult;
    duplicate_of: PublicationPrepGateResult;
    member_consent: PublicationPrepGateResult;
    publication_target: PublicationPrepGateResult;
    credit_line: PublicationPrepGateResult;
    channel_rights_evidence: PublicationPrepGateResult;
  };
};

export type PublicationPrepMemberContext = {
  submission_type: string;
  consent_status: string;
  credit_preference: string;
  admin_followup_required: boolean;
};

export type PublicationPrepView = {
  candidate_id: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string | null;
  content_type: string;
  input_stream: string;
  date_or_period: string | null;
  credit_line: string | null;
  publication_status: string;
  publication_target: string | null;
  review_status: string;
  rights_status: string;
  privacy_review_status: string;
  privacy_flag: string;
  relevance_status: string;
  source_trust_status: string;
  content_inventory_id: number | null;
  tags: { people: string[]; topics: string[]; places: string[] };
  media_references: AdminMediaReferenceFields;
  eligibility: PublicationPrepEligibility;
  member_submission?: PublicationPrepMemberContext;
};

export type PublicationPrepListFilter = CandidateListFilter & {
  eligible_only?: boolean;
};

function gate(pass: boolean, value: string | null, requirement: string): PublicationPrepGateResult {
  return { pass, value, requirement };
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseLimit(raw: string | null): number {
  const n = Number(raw || '50');
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 200) : 50;
}

function parseOffset(raw: string | null): number {
  const n = Number(raw || '0');
  return Number.isFinite(n) ? Math.max(Math.floor(n), 0) : 0;
}

export function evaluatePublicationPrepEligibility(
  candidate: Pick<
    StoredCandidate,
    | 'review_status'
    | 'rights_status'
    | 'privacy_review_status'
    | 'source_trust_status'
    | 'relevance_status'
    | 'publication_status'
    | 'publication_target'
    | 'credit_line'
    | 'duplicate_of'
    | 'input_stream'
    | 'content_inventory_id'
  >,
  memberSubmission?: PublicationPrepMemberContext | null,
  // Authoritative per-channel rights_evidence resolution for this candidate's
  // publication_target channel, from getCurrentConclusionForCandidateChannel.
  // `null`/omitted means "not applicable" (not a scheduled_discovery
  // candidate, or its publication_target doesn't map to a known channel) --
  // the gate below is a no-op in that case, by construction, for every
  // input_stream other than scheduled_discovery (#2270's separate model for
  // member_submission/admin_seed/public_research is left untouched).
  channelConclusionFound?: boolean | null,
): PublicationPrepEligibility {
  const reasons: string[] = [];

  const reviewGate = gate(
    PREP_APPROVED_REVIEW_STATUSES.has(candidate.review_status),
    candidate.review_status,
    'review_status must be an approved review state',
  );
  if (!reviewGate.pass) {
    reasons.push(reviewGate.requirement);
  }

  const rightsGate = gate(
    PREP_ACCEPTABLE_RIGHTS_STATUSES.has(candidate.rights_status),
    candidate.rights_status,
    'rights_status must be permission_granted or public_domain_candidate',
  );
  if (!rightsGate.pass) {
    reasons.push(rightsGate.requirement);
  }

  const privacyGate = gate(
    PREP_ACCEPTABLE_PRIVACY_REVIEW_STATUSES.has(candidate.privacy_review_status),
    candidate.privacy_review_status,
    'privacy_review_status must be approved or not_applicable',
  );
  if (!privacyGate.pass) {
    reasons.push(privacyGate.requirement);
  }

  const sourceTrustGate = gate(
    !PREP_BLOCKED_SOURCE_TRUST_STATUSES.has(candidate.source_trust_status),
    candidate.source_trust_status,
    'source_trust_status must not be blocked or deleted',
  );
  if (!sourceTrustGate.pass) {
    reasons.push(sourceTrustGate.requirement);
  }

  const relevanceGate = gate(
    !PREP_BLOCKED_RELEVANCE_STATUSES.has(candidate.relevance_status),
    candidate.relevance_status,
    'relevance_status must not be pending or not_relevant',
  );
  if (!relevanceGate.pass) {
    reasons.push(relevanceGate.requirement);
  }

  const publicationGate = gate(
    PREP_VALID_PUBLICATION_STATUSES.has(candidate.publication_status),
    candidate.publication_status,
    'publication_status must be draft_candidate, staged, or approved_for_publish',
  );
  if (!publicationGate.pass) {
    reasons.push(publicationGate.requirement);
  }

  const duplicateGate = gate(
    !candidate.duplicate_of,
    candidate.duplicate_of ?? null,
    'duplicate_of must be unset before publication prep',
  );
  if (!duplicateGate.pass) {
    reasons.push(duplicateGate.requirement);
  }

  const memberConsentValue =
    candidate.input_stream === 'member_submission'
      ? (memberSubmission?.consent_status ?? 'missing')
      : 'not_applicable';
  const memberConsentGate = gate(
    candidate.input_stream !== 'member_submission' ||
      (memberSubmission !== undefined &&
        memberSubmission !== null &&
        memberSubmission.consent_status === 'granted'),
    memberConsentValue,
    'member submissions require consent_status granted',
  );
  if (!memberConsentGate.pass) {
    reasons.push(memberConsentGate.requirement);
  }

  const publicationTargetValue = candidate.publication_target ?? null;
  const publicationTargetGate = gate(
    candidate.publication_status !== 'approved_for_publish' || Boolean(publicationTargetValue),
    publicationTargetValue,
    'publication_target is required when publication_status is approved_for_publish',
  );
  if (!publicationTargetGate.pass) {
    reasons.push(publicationTargetGate.requirement);
  }

  const creditLineValue = candidate.credit_line ?? null;
  const creditLineGate = gate(
    candidate.publication_status !== 'approved_for_publish' || Boolean(creditLineValue),
    creditLineValue,
    'credit_line is required when publication_status is approved_for_publish',
  );
  if (!creditLineGate.pass) {
    reasons.push(creditLineGate.requirement);
  }

  // #3551's 2026-08-18 channel-scoping directive: for scheduled_discovery
  // candidates whose publication_target maps to a known channel, a
  // conclusion recorded for a DIFFERENT channel does not authorize this one.
  // Inert (always passes) for every other input_stream, and for a
  // publication_target with no known channel mapping.
  const targetChannel = channelForPublicationTarget(candidate.publication_target ?? null);
  const channelRightsGate = gate(
    candidate.input_stream !== 'scheduled_discovery' || !targetChannel || channelConclusionFound === true,
    channelConclusionFound === null || channelConclusionFound === undefined ? null : String(channelConclusionFound),
    "rights_evidence must carry a conclusion for the candidate's specific publication_target channel (scheduled_discovery only)",
  );
  if (!channelRightsGate.pass) {
    reasons.push(channelRightsGate.requirement);
  }

  const gates = {
    review_status: reviewGate,
    rights_status: rightsGate,
    privacy_review_status: privacyGate,
    source_trust_status: sourceTrustGate,
    relevance_status: relevanceGate,
    publication_status: publicationGate,
    duplicate_of: duplicateGate,
    member_consent: memberConsentGate,
    publication_target: publicationTargetGate,
    credit_line: creditLineGate,
    channel_rights_evidence: channelRightsGate,
  };

  return {
    eligible: reasons.length === 0,
    reasons,
    gates,
  };
}

export function resolvePublicationPrepSourceName(
  candidate: Pick<StoredCandidate, 'input_stream' | 'source_name'>,
): string {
  if (candidate.input_stream === 'member_submission') {
    return MEMBER_SUBMISSION_PREP_SOURCE_NAME;
  }
  return candidate.source_name;
}

export function serializePublicationPrepView(input: {
  candidate: StoredCandidate;
  mediaReferences: AdminMediaReferenceFields;
  eligibility: PublicationPrepEligibility;
  memberSubmission?: PublicationPrepMemberContext | null;
}): PublicationPrepView {
  const { candidate, mediaReferences, eligibility, memberSubmission } = input;
  const view: PublicationPrepView = {
    candidate_id: candidate.candidate_id,
    title: candidate.title,
    summary: candidate.summary,
    source_name: resolvePublicationPrepSourceName(candidate),
    source_url: candidate.source_url ?? null,
    content_type: candidate.content_type,
    input_stream: candidate.input_stream,
    date_or_period: candidate.date_or_period ?? null,
    credit_line: candidate.credit_line ?? null,
    publication_status: candidate.publication_status,
    publication_target: candidate.publication_target ?? null,
    review_status: candidate.review_status,
    rights_status: candidate.rights_status,
    privacy_review_status: candidate.privacy_review_status,
    privacy_flag: candidate.privacy_flag,
    relevance_status: candidate.relevance_status,
    source_trust_status: candidate.source_trust_status,
    content_inventory_id: candidate.content_inventory_id ?? null,
    tags: candidate.tags ?? { people: [], topics: [], places: [] },
    media_references: mediaReferences,
    eligibility,
  };

  if (candidate.input_stream === 'member_submission' && memberSubmission) {
    view.member_submission = {
      submission_type: memberSubmission.submission_type,
      consent_status: memberSubmission.consent_status,
      credit_preference: memberSubmission.credit_preference,
      admin_followup_required: memberSubmission.admin_followup_required,
    };
  }

  return view;
}

export async function fetchMemberSubmissionPrepContext(
  db: any,
  contentItemId: number,
): Promise<PublicationPrepMemberContext | null> {
  const row = await db
    .prepare(
      `SELECT submission_type, consent_status, credit_preference, admin_followup_required
       FROM member_submissions
       WHERE content_item_id = ?
       LIMIT 1`,
    )
    .bind(contentItemId)
    .first();

  if (!row) {
    return null;
  }

  const record = row as {
    submission_type?: string;
    consent_status?: string;
    credit_preference?: string;
    admin_followup_required?: number | boolean;
  };

  return {
    submission_type: String(record.submission_type ?? ''),
    consent_status: String(record.consent_status ?? ''),
    credit_preference: String(record.credit_preference ?? ''),
    admin_followup_required: Boolean(record.admin_followup_required),
  };
}

export async function buildPublicationPrepViewForCandidate(
  db: any,
  candidate: StoredCandidate,
): Promise<PublicationPrepView> {
  const memberSubmission =
    candidate.input_stream === 'member_submission'
      ? await fetchMemberSubmissionPrepContext(db, candidate.id)
      : null;
  const uploadedMediaReference =
    candidate.input_stream === 'member_submission'
      ? await getUploadedMediaReferenceForCandidate(db, candidate.id)
      : null;
  const mediaReferences = serializeAdminMediaReferences(
    candidate as unknown as Record<string, unknown>,
    uploadedMediaReference,
  );

  // Only scheduled_discovery candidates are governed by #3551's channel
  // scoping; every other input_stream gets `null` (not applicable), which
  // keeps the channel_rights_evidence gate inert -- a single extra indexed
  // query is added per scheduled_discovery candidate only, not per row.
  let channelConclusionFound: boolean | null = null;
  if (candidate.input_stream === 'scheduled_discovery') {
    const targetChannel = channelForPublicationTarget(candidate.publication_target ?? null);
    if (targetChannel) {
      const channelConclusion = await getCurrentConclusionForCandidateChannel(db, candidate.id, targetChannel);
      channelConclusionFound = channelConclusion !== null;
    }
  }

  const eligibility = evaluatePublicationPrepEligibility(candidate, memberSubmission, channelConclusionFound);

  return serializePublicationPrepView({
    candidate,
    mediaReferences,
    eligibility,
    memberSubmission,
  });
}

export async function getPublicationPrepViewByCandidateId(
  db: any,
  candidateId: string,
): Promise<PublicationPrepView | null> {
  const candidate = await getCandidateByCandidateId(db, candidateId);
  if (!candidate) {
    return null;
  }
  return buildPublicationPrepViewForCandidate(db, candidate);
}

export async function listPublicationPrepViews(
  db: any,
  filter: PublicationPrepListFilter = {},
): Promise<PublicationPrepView[]> {
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  const eligibleOnly = filter.eligible_only !== false;
  const repoFilter: CandidateListFilter = {
    review_status: filter.review_status,
    input_stream: filter.input_stream,
    review_priority: filter.review_priority,
    publication_status: filter.publication_status,
    include_deleted: filter.include_deleted,
  };

  if (!eligibleOnly) {
    const candidates = await listCandidates(db, { ...repoFilter, limit, offset });
    return Promise.all(candidates.map((candidate) => buildPublicationPrepViewForCandidate(db, candidate)));
  }

  const eligibleViews: PublicationPrepView[] = [];
  let scanOffset = 0;
  const scanBatch = 200;

  while (true) {
    const batch = await listCandidates(db, { ...repoFilter, limit: scanBatch, offset: scanOffset });
    if (batch.length === 0) {
      break;
    }

    for (const candidate of batch) {
      const view = await buildPublicationPrepViewForCandidate(db, candidate);
      if (view.eligibility.eligible) {
        eligibleViews.push(view);
      }
    }

    if (batch.length < scanBatch) {
      break;
    }
    scanOffset += scanBatch;
  }

  return eligibleViews.slice(offset, offset + limit);
}

export function parsePublicationPrepListQuery(
  url: URL,
): { ok: true; filter: PublicationPrepListFilter } | { ok: false; error: string } {
  const filter: PublicationPrepListFilter = {
    limit: parseLimit(url.searchParams.get('limit')),
    offset: parseOffset(url.searchParams.get('offset')),
    eligible_only: true,
  };

  const eligibleOnly = url.searchParams.get('eligible_only');
  if (eligibleOnly === '0' || eligibleOnly === 'false') {
    filter.eligible_only = false;
  }

  const reviewStatus = asTrimmedString(url.searchParams.get('review_status'));
  if (reviewStatus) {
    if (!REVIEW_STATUSES.has(reviewStatus)) {
      return { ok: false, error: 'Invalid review_status filter.' };
    }
    filter.review_status = reviewStatus;
  }

  const publicationStatus = asTrimmedString(url.searchParams.get('publication_status'));
  if (publicationStatus) {
    if (!PUBLICATION_STATUSES.has(publicationStatus)) {
      return { ok: false, error: 'Invalid publication_status filter.' };
    }
    filter.publication_status = publicationStatus;
  }

  if (url.searchParams.get('include_deleted') === '1' || url.searchParams.get('include_deleted') === 'true') {
    filter.include_deleted = true;
  }

  return { ok: true, filter };
}

export function isValidPublicationPrepCandidateId(candidateId: string): boolean {
  return CANDIDATE_ID_PATTERN.test(candidateId);
}

export { CANDIDATE_ID_VALIDATION_MESSAGE };
