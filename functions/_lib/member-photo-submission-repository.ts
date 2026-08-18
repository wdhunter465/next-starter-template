// D1 repository for #3552/#3553 Path C: club members uploading their own
// photos through the FanClub page. Uses the same two-choice rights model as
// the article intake path (content-pipeline-member-submission-intake.ts):
// member_owns_full_grant clears rights immediately (no separate admin step,
// per explicit product direction) and records a real rights_evidence
// conclusion; external_source_needs_evaluation leaves the photo held and
// queues it into the same admin copyright-evaluation review Path B's
// externally-sourced candidates use. Mirrors Path B's separation of
// concerns (media-ingest-repository.ts, rights-evidence-repository.ts).

import { requireTables } from './d1';
import { recordRightsEvidence } from './rights-evidence-repository';

export const MEMBER_PHOTO_SUBMISSION_TABLES = [
  'content_items',
  'member_submissions',
  'submitters',
  'media_assets',
  'tags',
  'content_item_tags',
  'rights_evidence',
] as const;

export async function requireMemberPhotoSubmissionTables(db: unknown) {
  return requireTables(db, [...MEMBER_PHOTO_SUBMISSION_TABLES]);
}

export type CreditPreference = 'public_credit' | 'anonymous' | 'private' | 'custom';

export const PHOTO_RIGHTS_CHOICES = ['member_owns_full_grant', 'external_source_needs_evaluation'] as const;
export type PhotoRightsChoice = (typeof PHOTO_RIGHTS_CHOICES)[number];

export type CommitMemberPhotoSubmissionInput = {
  submitterEmail: string;
  submitterName: string;
  rightsChoice: PhotoRightsChoice;
  sourceUrl?: string | null;
  creditPreference: CreditPreference;
  customCreditLine?: string | null;
  caption?: string | null;
  mediaUid: string;
  b2Key: string;
  size: number;
  etag?: string | null;
  peopleTags?: string[];
  topicTags?: string[];
  locationTags?: string[];
};

export type CommitMemberPhotoSubmissionResult = {
  contentItemId: number;
  candidateId: string;
  memberSubmissionId: number;
  mediaUid: string;
  b2Key: string;
  alreadyExisted: boolean;
  rightsHold: 0 | 1;
};

async function findOrCreateSubmitter(
  db: any,
  { email, name }: { email: string; name: string },
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO submitters (member_submitter_id, submitter_name, submitter_contact)
       VALUES (?, ?, ?)
       ON CONFLICT(member_submitter_id) DO UPDATE SET
         submitter_name = excluded.submitter_name,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(email, name, email)
    .run();

  const row = await db
    .prepare('SELECT id FROM submitters WHERE member_submitter_id = ? LIMIT 1')
    .bind(email)
    .first();

  if (!row) {
    throw new Error(`Failed to find/create submitter for ${email}`);
  }
  return Number((row as { id: number }).id);
}

function creditLineFor(input: CommitMemberPhotoSubmissionInput): string | null {
  switch (input.creditPreference) {
    case 'public_credit':
      return input.submitterName || null;
    case 'custom':
      return input.customCreditLine?.trim() || null;
    case 'anonymous':
    case 'private':
    default:
      return null;
  }
}

// The two rights choices deterministically resolve the entire rights/consent
// state -- same shape as deriveRightsOutcome in the article intake path,
// but the photo-specific rights_evidence conclusion
// (lgfc_member_owned_item_photo) and no publication staging (photos become
// publicly visible through media_assets.rights_hold -> the daily B2 sync ->
// reconcile-photos-rights-from-media-assets.mjs (#3598), not through
// publication_candidates/content_inventory).
function deriveRightsOutcome(rightsChoice: PhotoRightsChoice) {
  if (rightsChoice === 'member_owns_full_grant') {
    return {
      ownershipStatement: 'Member attests they own the copyright, or this image shows their personal collection.',
      permissionStatement: 'Member grants LGFC full permission to use this photo on the website.',
      consentStatus: 'granted',
      rightsStatus: 'permission_granted',
      reviewStatus: 'approved_public_candidate',
      adminFollowupRequired: false,
      rightsHold: 0 as const,
    };
  }
  return {
    ownershipStatement: 'Photo found elsewhere; the member does not claim copyright ownership.',
    permissionStatement: 'Submitted for copyright evaluation pending an admin decision.',
    consentStatus: 'pending',
    rightsStatus: 'permission_needed',
    reviewStatus: 'pending_review',
    adminFollowupRequired: true,
    rightsHold: 1 as const,
  };
}

async function syncContentItemTags(
  db: any,
  contentItemId: number,
  tags: { peopleTags?: string[]; topicTags?: string[]; locationTags?: string[] },
) {
  const entries: Array<{ category: 'people' | 'topics' | 'places'; name: string }> = [];
  for (const name of tags.peopleTags ?? []) entries.push({ category: 'people', name });
  for (const name of tags.topicTags ?? []) entries.push({ category: 'topics', name });
  for (const name of tags.locationTags ?? []) entries.push({ category: 'places', name });
  if (entries.length === 0) return;

  await db.prepare('DELETE FROM content_item_tags WHERE content_item_id = ?').bind(contentItemId).run();
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT INTO tags (tag_name, tag_category) VALUES (?, ?) ON CONFLICT(tag_name, tag_category) DO NOTHING`,
      )
      .bind(entry.name, entry.category)
      .run();
    await db
      .prepare(
        `INSERT INTO content_item_tags (content_item_id, tag_id)
         SELECT ?, t.id FROM tags t WHERE t.tag_name = ? AND t.tag_category = ?
         ON CONFLICT(content_item_id, tag_id) DO NOTHING`,
      )
      .bind(contentItemId, entry.name, entry.category)
      .run();
  }
}

// Idempotent on mediaUid (derived from the content checksum): a retried
// upload of identical bytes re-links to the same media_assets row rather
// than creating a duplicate.
export async function commitMemberPhotoSubmission(
  db: any,
  input: CommitMemberPhotoSubmissionInput,
): Promise<CommitMemberPhotoSubmissionResult> {
  const submitterId = await findOrCreateSubmitter(db, {
    email: input.submitterEmail,
    name: input.submitterName,
  });

  const outcome = deriveRightsOutcome(input.rightsChoice);
  const candidateId = `member-photo-${input.mediaUid}`;
  const title = input.caption?.trim() || `Member photo from ${input.submitterName}`;
  const summary = input.caption?.trim() || 'Photo submitted by a club member for rights review.';

  const rightsHoldReason =
    outcome.rightsHold === 0
      ? `member_attestation:lgfc_member_owned_item_photo reviewer:${input.submitterName}`
      : null;

  const insertResult = await db
    .prepare(
      `INSERT INTO media_assets (media_uid, b2_key, b2_file_id, size, etag, rights_hold, rights_hold_reason, rights_hold_set_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
       ON CONFLICT(media_uid) DO NOTHING`,
    )
    .bind(
      input.mediaUid,
      input.b2Key,
      input.size,
      input.etag ?? null,
      outcome.rightsHold,
      rightsHoldReason,
      outcome.rightsHold === 0 ? new Date().toISOString() : null,
    )
    .run();
  const alreadyExisted = Number((insertResult as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0;

  await db
    .prepare(
      `INSERT INTO content_items (
        candidate_id, input_stream, title, source_url, source_name, source_owner, source_domain,
        source_type, content_type, summary, date_or_period, provenance_notes,
        rights_status, source_trust_status, relevance_status, review_status,
        publication_status, publication_target, privacy_flag, privacy_review_status,
        credit_line, media_asset_id, duplicate_of, review_priority, admin_notes, source_metadata
      ) VALUES (?, 'member_submission', ?, ?, ?, NULL, NULL,
        'member', 'photo', ?, NULL, NULL,
        ?, 'pending', 'pending', ?,
        'not_ready', NULL, 'donor_member', 'pending_review',
        ?, ?, NULL, 'normal', NULL, '{}')
       ON CONFLICT(candidate_id) DO NOTHING`,
    )
    .bind(
      candidateId,
      title,
      input.sourceUrl ?? null,
      input.submitterName,
      summary,
      outcome.rightsStatus,
      outcome.reviewStatus,
      creditLineFor(input),
      `b2://${input.b2Key}`,
    )
    .run();

  const contentItem = await db
    .prepare('SELECT id FROM content_items WHERE candidate_id = ? LIMIT 1')
    .bind(candidateId)
    .first();
  if (!contentItem) {
    throw new Error(`Failed to find/create content_items row for ${candidateId}`);
  }
  const contentItemId = Number((contentItem as { id: number }).id);

  await db
    .prepare(
      `INSERT INTO member_submissions (
        content_item_id, submitter_id, submission_type, ownership_statement, permission_statement,
        credit_preference, privacy_notes, uploaded_media_reference, related_candidate_id,
        consent_status, admin_followup_required
      ) VALUES (?, ?, 'photo', ?, ?, ?, NULL, ?, NULL, ?, ?)
       ON CONFLICT(content_item_id) DO NOTHING`,
    )
    .bind(
      contentItemId,
      submitterId,
      outcome.ownershipStatement,
      outcome.permissionStatement,
      input.creditPreference,
      input.b2Key,
      outcome.consentStatus,
      outcome.adminFollowupRequired ? 1 : 0,
    )
    .run();

  const memberSubmission = await db
    .prepare('SELECT id FROM member_submissions WHERE content_item_id = ? LIMIT 1')
    .bind(contentItemId)
    .first();
  if (!memberSubmission) {
    throw new Error(`Failed to find/create member_submissions row for content_item_id=${contentItemId}`);
  }

  await syncContentItemTags(db, contentItemId, {
    peopleTags: input.peopleTags,
    topicTags: input.topicTags,
    locationTags: input.locationTags,
  });

  // Records *why* the rights state landed where it did, mirroring Path B's
  // evidence trail. See deriveRightsOutcome above for the safety rationale.
  if (input.rightsChoice === 'member_owns_full_grant') {
    await recordRightsEvidence(db, {
      content_item_id: contentItemId,
      evidence_type: 'member_ownership',
      evidence_text: outcome.ownershipStatement,
      reviewer: input.submitterName,
      conclusion: 'lgfc_member_owned_item_photo',
      conclusion_rationale:
        'Member attestation: owns the copyright, or the image shows their personal collection; permission fully granted.',
    });
  } else {
    await recordRightsEvidence(db, {
      content_item_id: contentItemId,
      evidence_type: 'other',
      evidence_text: 'Member submitted a photo found elsewhere; source provided for copyright evaluation.',
      evidence_url: input.sourceUrl ?? null,
      reviewer: null,
      conclusion: null,
      conclusion_rationale: null,
    });
  }

  return {
    contentItemId,
    candidateId,
    memberSubmissionId: Number((memberSubmission as { id: number }).id),
    mediaUid: input.mediaUid,
    b2Key: input.b2Key,
    alreadyExisted,
    rightsHold: outcome.rightsHold,
  };
}
