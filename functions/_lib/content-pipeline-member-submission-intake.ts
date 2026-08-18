// Member submission intake persistence for LGFC content pipeline (#2286 / #2316).

import {
  CANDIDATE_ID_PATTERN,
  CONTENT_PIPELINE_CREDIT_PREFERENCES,
  CONTENT_PIPELINE_PRIVACY_FLAGS,
  CONTENT_PIPELINE_SUBMISSION_TYPES,
  CREDIT_PREFERENCES,
  PRIVACY_FLAGS,
  PUBLICATION_TARGETS,
  SUBMISSION_TYPES,
} from './content-pipeline-candidate-constants';
import {
  validateCandidateRegistry,
  type CandidateRecord,
  type MemberSubmissionExtension,
} from './content-pipeline-candidate-import';
import { requireTables } from './d1';
import { validateOptionalContentPipelineMediaReference } from './content-pipeline-media-reference';
import { recordRightsEvidence } from './rights-evidence-repository';

// Fully-granted submissions become publication_status='approved_for_publish',
// which requires a credit_line and a publication_target (enforced by
// validateCandidateRegistry) -- 'library' matches this flow's existing
// framing ("submit ... to be considered for the Library").
const DEFAULT_MEMBER_SUBMISSION_PUBLICATION_TARGET = 'library';

function deriveCreditLine(creditPreference: string, submitterName: string, explicitCreditLine: string): string {
  if (explicitCreditLine) return explicitCreditLine;
  switch (creditPreference) {
    case 'public_credit':
      return submitterName;
    case 'anonymous':
      return 'Anonymous';
    case 'private':
    case 'custom':
    default:
      return 'LGFC Member';
  }
}

export const MEMBER_SUBMISSION_INTAKE_TABLES = [
  'content_items',
  'submitters',
  'member_submissions',
  'tags',
  'content_item_tags',
  'rights_evidence',
] as const;

// #3552/#3553: replaces the old free-text ownership_statement/permission_statement
// pair (unclear how to action -- reviewers had to parse prose to figure out
// what a submitter meant) with two mutually exclusive, unambiguous choices.
// The choice alone fully determines the resulting rights/consent state --
// nothing here is inferred from free text anymore.
export const RIGHTS_CHOICES = ['member_owns_full_grant', 'external_source_needs_evaluation'] as const;
export type RightsChoice = (typeof RIGHTS_CHOICES)[number];
const RIGHTS_CHOICE_SET = new Set<string>(RIGHTS_CHOICES);

const SUBMISSION_TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  story: 'story',
  photo: 'photo',
  memorabilia: 'artifact',
  correction: 'correction',
  identification: 'identification',
  source_lead: 'source_lead',
  historical_note: 'biography_note',
};

const MEMBER_INTAKE_SOURCE_TYPE = 'member';
const MAX_CANDIDATE_ID_ALLOCATION_ATTEMPTS = 5;

export type MemberSubmissionIntakeRequest = {
  submitter_name: string;
  title: string;
  summary: string;
  submission_type: string;
  rights_choice: RightsChoice;
  credit_preference: string;
  // Fully derived from rights_choice (+ privacy_flag) -- never accepted from
  // the client. See deriveRightsOutcome.
  ownership_statement: string;
  permission_statement: string;
  consent_status: string;
  rights_status: string;
  review_status: string;
  publication_status: string;
  publication_target?: string;
  admin_followup_required: boolean;
  source_name?: string;
  source_url?: string;
  credit_line?: string;
  date_or_period?: string;
  privacy_flag?: string;
  privacy_notes?: string;
  uploaded_media_reference?: string;
  related_candidate_id?: string;
  people_tags?: string[];
  topic_tags?: string[];
  location_tags?: string[];
};

export type MemberSubmissionIntakeResult = {
  candidate_id: string;
  input_stream: 'member_submission';
  publication_status: string;
  review_status: string;
  rights_status: string;
  admin_followup_required: boolean;
};

export type ParseMemberSubmissionIntakeResult =
  | { ok: true; request: MemberSubmissionIntakeRequest }
  | { ok: false; error: string };

type D1PreparedStatement = {
  run: () => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.map((entry) => asTrimmedString(entry)).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function pushEnumError(errors: string[], path: string, value: unknown, allowed: Set<string>) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    errors.push(`${path} must be one of: ${[...allowed].join(', ')}`);
  }
}

export function candidateAllocationYearFromIso(now: string): number {
  const match = /^(\d{4})/.exec(now);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return new Date(now).getUTCFullYear();
}

export function deriveMemberIntakeContentType(submissionType: string): string {
  return SUBMISSION_TYPE_TO_CONTENT_TYPE[submissionType] ?? 'other';
}

export function isCandidateIdUniqueConflict(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return message.includes('unique constraint failed') && message.includes('content_items.candidate_id');
}

// The two rights choices deterministically resolve the entire rights/consent
// state -- nothing here is inferred from free text. member_owns_full_grant
// clears rights immediately (no separate admin step, per explicit product
// direction); external_source_needs_evaluation queues it for the same
// copyright-evaluation review Path B's externally-sourced candidates get.
// Privacy follow-up (a materially different concern from copyright) is
// still tracked independently and can require follow-up even on a
// fully-granted submission.
export function deriveRightsOutcome(
  rightsChoice: RightsChoice,
  privacyFlag: string,
): {
  ownership_statement: string;
  permission_statement: string;
  consent_status: string;
  rights_status: string;
  review_status: string;
  publication_status: string;
  admin_followup_required: boolean;
} {
  const privacyNeedsFollowup = ['living_person', 'minors', 'sensitive'].includes(privacyFlag);

  if (rightsChoice === 'member_owns_full_grant') {
    return {
      ownership_statement: 'Member attests this content was created by them or is from their personal collection.',
      permission_statement: 'Member grants LGFC full permission to use this content on the website.',
      consent_status: 'granted',
      rights_status: 'permission_granted',
      review_status: 'approved_public_candidate',
      // Privacy review is a separate concern from copyright -- a fully
      // rights-cleared submission about a living person still isn't
      // publish-ready until that's independently resolved.
      publication_status: privacyNeedsFollowup ? 'not_ready' : 'approved_for_publish',
      admin_followup_required: privacyNeedsFollowup,
    };
  }

  return {
    ownership_statement: 'Content found elsewhere; the member is not claiming ownership.',
    permission_statement: 'Submitted for copyright evaluation pending an admin decision.',
    consent_status: 'pending',
    rights_status: 'permission_needed',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    admin_followup_required: true,
  };
}

export function parseMemberSubmissionIntakeBody(body: unknown): ParseMemberSubmissionIntakeResult {
  if (!isRecord(body)) {
    return { ok: false, error: 'Invalid JSON body.' };
  }

  const submitterName = asTrimmedString(body.submitter_name ?? body.name);
  const title = asTrimmedString(body.title);
  const summary = asTrimmedString(body.summary ?? body.content);
  const submissionType = asTrimmedString(body.submission_type);
  const rightsChoice = asTrimmedString(body.rights_choice);
  const creditPreference = asTrimmedString(body.credit_preference);
  const privacyFlag = asTrimmedString(body.privacy_flag) || 'none';
  const sourceUrl = asTrimmedString(body.source_url);

  const errors: string[] = [];
  if (!submitterName) errors.push('submitter_name is required.');
  if (!title) errors.push('title is required.');
  if (!summary) errors.push('summary (or content) is required.');
  if (!submissionType) errors.push('submission_type is required.');
  if (!creditPreference) errors.push('credit_preference is required.');

  if (!rightsChoice || !RIGHTS_CHOICE_SET.has(rightsChoice)) {
    errors.push(`rights_choice is required and must be one of: ${RIGHTS_CHOICES.join(', ')}`);
  } else if (rightsChoice === 'external_source_needs_evaluation' && !sourceUrl) {
    errors.push('source_url is required when rights_choice is external_source_needs_evaluation.');
  }

  pushEnumError(errors, 'submission_type', submissionType, SUBMISSION_TYPES);
  pushEnumError(errors, 'credit_preference', creditPreference, CREDIT_PREFERENCES);
  pushEnumError(errors, 'privacy_flag', privacyFlag, PRIVACY_FLAGS);

  const explicitPublicationTarget = asTrimmedString(body.publication_target);
  if (explicitPublicationTarget) {
    pushEnumError(errors, 'publication_target', explicitPublicationTarget, PUBLICATION_TARGETS);
  }

  if (asTrimmedString(body.source_type)) {
    errors.push('source_type is not accepted on member intake; classification is determined server-side.');
  }
  if (asTrimmedString(body.content_type)) {
    errors.push('content_type is not accepted on member intake; derived from submission_type.');
  }
  if (asTrimmedString(body.ownership_statement) || asTrimmedString(body.permission_statement)) {
    errors.push(
      'ownership_statement/permission_statement are no longer accepted; use rights_choice instead.',
    );
  }

  const relatedCandidateId = asTrimmedString(body.related_candidate_id);
  if (relatedCandidateId && !CANDIDATE_ID_PATTERN.test(relatedCandidateId)) {
    errors.push('related_candidate_id must match lgfc-gehrig-YYYY-NNN with at least 3 trailing digits.');
  }

  const uploadedMediaReference = asTrimmedString(body.uploaded_media_reference);
  if (uploadedMediaReference) {
    const validatedReference = validateOptionalContentPipelineMediaReference(
      uploadedMediaReference,
      'uploaded_media_reference',
    );
    if (!validatedReference.ok) {
      errors.push(validatedReference.error);
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join(' ') };
  }

  const outcome = deriveRightsOutcome(rightsChoice as RightsChoice, privacyFlag);
  const creditLine = deriveCreditLine(creditPreference, submitterName, asTrimmedString(body.credit_line));
  const publicationTarget =
    explicitPublicationTarget ||
    (outcome.publication_status === 'approved_for_publish' ? DEFAULT_MEMBER_SUBMISSION_PUBLICATION_TARGET : undefined);

  return {
    ok: true,
    request: {
      submitter_name: submitterName,
      title,
      summary,
      submission_type: submissionType,
      rights_choice: rightsChoice as RightsChoice,
      credit_preference: creditPreference,
      ...outcome,
      publication_target: publicationTarget,
      source_name: asTrimmedString(body.source_name) || undefined,
      source_url: sourceUrl || undefined,
      credit_line: creditLine,
      date_or_period: asTrimmedString(body.date_or_period) || undefined,
      privacy_flag: privacyFlag,
      privacy_notes: asTrimmedString(body.privacy_notes) || undefined,
      uploaded_media_reference: asTrimmedString(body.uploaded_media_reference) || undefined,
      related_candidate_id: relatedCandidateId || undefined,
      people_tags: asStringArray(body.people_tags),
      topic_tags: asStringArray(body.topic_tags),
      location_tags: asStringArray(body.location_tags),
    },
  };
}

export function buildMemberSubmissionCandidateRecord(
  request: MemberSubmissionIntakeRequest,
  options: {
    candidateId: string;
    submitterContact: string;
    memberSubmitterId: string;
    now: string;
  },
): CandidateRecord {
  const contentType = deriveMemberIntakeContentType(request.submission_type);

  const memberSubmission: MemberSubmissionExtension = {
    submitter_id: options.memberSubmitterId,
    submitter_name: request.submitter_name,
    submitter_contact: options.submitterContact,
    submission_type: request.submission_type,
    ownership_statement: request.ownership_statement,
    permission_statement: request.permission_statement,
    credit_preference: request.credit_preference,
    privacy_notes: request.privacy_notes,
    uploaded_media_reference: request.uploaded_media_reference,
    related_candidate_id: request.related_candidate_id,
    consent_status: request.consent_status,
    admin_followup_required: request.admin_followup_required,
  };

  return {
    candidate_id: options.candidateId,
    input_stream: 'member_submission',
    title: request.title,
    source_url: request.source_url,
    source_name: request.source_name || request.submitter_name,
    source_type: MEMBER_INTAKE_SOURCE_TYPE,
    content_type: contentType,
    summary: request.summary,
    date_or_period: request.date_or_period,
    people_tags: request.people_tags,
    topic_tags: request.topic_tags,
    location_tags: request.location_tags,
    rights_status: request.rights_status,
    source_trust_status: 'pending',
    relevance_status: 'pending',
    review_status: request.review_status,
    publication_status: request.publication_status,
    publication_target: request.publication_target,
    privacy_flag: request.privacy_flag || 'none',
    privacy_review_status: 'pending_review',
    credit_line: request.credit_line,
    review_priority: 'normal',
    member_submission: memberSubmission,
    created_at: options.now,
    updated_at: options.now,
  };
}

export async function requireMemberSubmissionIntakeTables(db: unknown) {
  return requireTables(db, [...MEMBER_SUBMISSION_INTAKE_TABLES]);
}

async function runD1Batch(db: any, statements: D1PreparedStatement[]) {
  if (statements.length === 0) {
    return;
  }

  if (typeof db.batch === 'function') {
    await db.batch(statements);
    return;
  }

  if (typeof db.exec === 'function') {
    await db.exec('BEGIN');
    try {
      for (const statement of statements) {
        await statement.run();
      }
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
    return;
  }

  for (const statement of statements) {
    await statement.run();
  }
}

export async function allocateMemberSubmissionCandidateId(db: any, year: number): Promise<string> {
  const prefix = `lgfc-gehrig-${year}-`;
  const sequenceStart = prefix.length + 1;
  const row = await db
    .prepare(
      `SELECT MAX(CAST(substr(candidate_id, ?) AS INTEGER)) AS max_seq
       FROM content_items
       WHERE candidate_id LIKE ?`,
    )
    .bind(sequenceStart, `${prefix}%`)
    .first();

  const maxSeq = Number((row as { max_seq?: number | null })?.max_seq ?? 0);
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

async function syncCandidateTags(db: any, contentItemId: number, candidate: CandidateRecord) {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM content_item_tags WHERE content_item_id = ?').bind(contentItemId),
  ];

  const tagEntries: Array<{ category: 'people' | 'topics' | 'places'; name: string }> = [];
  for (const name of candidate.people_tags ?? []) {
    tagEntries.push({ category: 'people', name });
  }
  for (const name of candidate.topic_tags ?? []) {
    tagEntries.push({ category: 'topics', name });
  }
  for (const name of candidate.location_tags ?? []) {
    tagEntries.push({ category: 'places', name });
  }

  for (const entry of tagEntries) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tags (tag_name, tag_category)
           VALUES (?, ?)
           ON CONFLICT(tag_name, tag_category) DO NOTHING`,
        )
        .bind(entry.name, entry.category),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO content_item_tags (content_item_id, tag_id)
           SELECT ?, t.id
           FROM tags t
           WHERE t.tag_name = ? AND t.tag_category = ?
           ON CONFLICT(content_item_id, tag_id) DO NOTHING`,
        )
        .bind(contentItemId, entry.name, entry.category),
    );
  }

  await runD1Batch(db, statements);
}

async function persistMemberSubmissionIntakeAttempt(
  db: any,
  request: MemberSubmissionIntakeRequest,
  options: { submitterContact: string; memberSubmitterId: string; now: string; candidateId: string },
): Promise<MemberSubmissionIntakeResult> {
  const candidate = buildMemberSubmissionCandidateRecord(request, options);

  const validation = validateCandidateRegistry({
    schema_version: '1',
    registry_class: 'operator_export',
    candidates: [candidate],
  });
  if (!validation.ok) {
    throw new Error(validation.errors.join('; '));
  }

  const member = candidate.member_submission;
  if (!member) {
    throw new Error('member_submission extension missing after candidate build.');
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO submitters (member_submitter_id, submitter_name, submitter_contact)
         VALUES (?, ?, ?)
         ON CONFLICT(member_submitter_id) DO UPDATE SET
           submitter_name = excluded.submitter_name,
           submitter_contact = excluded.submitter_contact,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      )
      .bind(options.memberSubmitterId, member.submitter_name, member.submitter_contact),
    db
      .prepare(
        `INSERT INTO content_items (
          candidate_id, input_stream, title, source_url, source_name, source_owner, source_domain,
          source_type, content_type, summary, date_or_period, provenance_notes,
          rights_status, source_trust_status, relevance_status, review_status, publication_status,
          publication_target, privacy_flag, privacy_review_status, credit_line, media_asset_id,
          duplicate_of, review_priority, admin_notes, source_metadata, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )`,
      )
      .bind(
        candidate.candidate_id,
        candidate.input_stream,
        candidate.title,
        candidate.source_url ?? null,
        candidate.source_name,
        candidate.source_owner ?? null,
        candidate.source_domain ?? null,
        candidate.source_type,
        candidate.content_type,
        candidate.summary,
        candidate.date_or_period ?? null,
        candidate.provenance_notes ?? null,
        candidate.rights_status,
        candidate.source_trust_status,
        candidate.relevance_status,
        candidate.review_status,
        candidate.publication_status,
        candidate.publication_target ?? null,
        candidate.privacy_flag,
        candidate.privacy_review_status,
        candidate.credit_line ?? null,
        candidate.media_asset_id ?? null,
        candidate.duplicate_of ?? null,
        candidate.review_priority,
        candidate.admin_notes ?? null,
        '{}',
        candidate.created_at,
        candidate.updated_at,
      ),
    db
      .prepare(
        `INSERT INTO member_submissions (
          content_item_id,
          submitter_id,
          submission_type,
          ownership_statement,
          permission_statement,
          credit_preference,
          privacy_notes,
          uploaded_media_reference,
          related_candidate_id,
          consent_status,
          admin_followup_required
        )
        SELECT
          ci.id,
          s.id,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        FROM content_items ci
        LEFT JOIN submitters s ON s.member_submitter_id = ?
        WHERE ci.candidate_id = ?`,
      )
      .bind(
        member.submission_type,
        member.ownership_statement,
        member.permission_statement,
        member.credit_preference,
        member.privacy_notes ?? null,
        member.uploaded_media_reference ?? null,
        member.related_candidate_id ?? null,
        member.consent_status,
        member.admin_followup_required ? 1 : 0,
        options.memberSubmitterId,
        candidate.candidate_id,
      ),
  ];

  await runD1Batch(db, statements);

  const contentItem = await db
    .prepare(`SELECT id FROM content_items WHERE candidate_id = ? LIMIT 1`)
    .bind(candidate.candidate_id)
    .first();

  if (!contentItem) {
    throw new Error(`Failed to load content_items row after insert for candidate_id=${candidate.candidate_id}`);
  }
  const contentItemId = Number((contentItem as { id: number }).id);

  if (candidate.people_tags?.length || candidate.topic_tags?.length || candidate.location_tags?.length) {
    await syncCandidateTags(db, contentItemId, candidate);
  }

  // A fully-granted submission is publication_status='approved_for_publish',
  // which only means anything if it's actually staged somewhere -- without
  // this, "no separate admin step" would leave it approved but invisible to
  // the normal promotion workflow. Mirrors content-pipeline-candidate-import's
  // buildPublicationCandidateUpsert.
  if (candidate.publication_status === 'approved_for_publish' && candidate.publication_target) {
    await db
      .prepare(
        `INSERT INTO publication_candidates (content_item_id, publication_target, credit_line, status)
         VALUES (?, ?, ?, 'staging')
         ON CONFLICT(content_item_id, publication_target) DO UPDATE SET
           credit_line = excluded.credit_line,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      )
      .bind(contentItemId, candidate.publication_target, candidate.credit_line ?? null)
      .run();
  }

  // Records *why* the rights state landed where it did, mirroring Path B's
  // evidence trail exactly. member_owns_full_grant records the member's own
  // attestation as a real, immediate conclusion (per explicit product
  // direction: no separate admin step). external_source_needs_evaluation
  // records the source with no conclusion yet -- this is what makes the
  // submission show up in the same admin copyright-evaluation queue Path B's
  // externally-sourced candidates use.
  if (request.rights_choice === 'member_owns_full_grant') {
    await recordRightsEvidence(db, {
      content_item_id: contentItemId,
      evidence_type: 'member_ownership',
      evidence_text: member.ownership_statement,
      reviewer: request.submitter_name,
      conclusion: 'permission_granted',
      conclusion_rationale: 'Member attestation: created by member or from their personal collection; permission fully granted.',
    });
  } else {
    await recordRightsEvidence(db, {
      content_item_id: contentItemId,
      evidence_type: 'other',
      evidence_text: 'Member submitted content found elsewhere; source provided for copyright evaluation.',
      evidence_url: request.source_url ?? null,
      reviewer: null,
      conclusion: null,
      conclusion_rationale: null,
    });
  }

  return {
    candidate_id: candidate.candidate_id,
    input_stream: 'member_submission',
    publication_status: candidate.publication_status,
    review_status: candidate.review_status,
    rights_status: candidate.rights_status,
    admin_followup_required: member.admin_followup_required,
  };
}

export async function persistMemberSubmissionIntake(
  db: any,
  request: MemberSubmissionIntakeRequest,
  options: { submitterContact: string; memberSubmitterId: string; now?: string },
): Promise<MemberSubmissionIntakeResult> {
  const memberSubmitterId = asTrimmedString(options.memberSubmitterId);
  if (!memberSubmitterId) {
    throw new Error('memberSubmitterId is required for member submission intake persistence.');
  }

  const now = options.now ?? new Date().toISOString();
  const year = candidateAllocationYearFromIso(now);
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CANDIDATE_ID_ALLOCATION_ATTEMPTS; attempt += 1) {
    const candidateId = await allocateMemberSubmissionCandidateId(db, year);
    try {
      return await persistMemberSubmissionIntakeAttempt(db, request, {
        submitterContact: options.submitterContact,
        memberSubmitterId,
        now,
        candidateId,
      });
    } catch (error) {
      if (isCandidateIdUniqueConflict(error) && attempt < MAX_CANDIDATE_ID_ALLOCATION_ATTEMPTS - 1) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Failed to allocate a unique candidate_id for member submission intake.');
}

export function serializeMemberSubmissionIntakeResponse(result: MemberSubmissionIntakeResult) {
  return {
    ok: true,
    candidate_id: result.candidate_id,
    input_stream: result.input_stream,
    publication_status: result.publication_status,
    review_status: result.review_status,
    rights_status: result.rights_status,
    admin_followup_required: result.admin_followup_required,
    message:
      result.rights_status === 'permission_granted'
        ? 'Submission recorded. Rights fully granted -- ready for publication review.'
        : 'Submission saved and queued for copyright evaluation.',
  };
}

export const MEMBER_INTAKE_ENUM_REFERENCE = {
  submission_types: [...CONTENT_PIPELINE_SUBMISSION_TYPES],
  credit_preferences: [...CONTENT_PIPELINE_CREDIT_PREFERENCES],
  rights_choices: [...RIGHTS_CHOICES],
  privacy_flags: [...CONTENT_PIPELINE_PRIVACY_FLAGS],
} as const;
