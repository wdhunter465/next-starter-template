// D1 repository for #3552/#3553 Path C: club members uploading their own
// photos, with a required rights-attestation checkbox, through the FanClub
// page. Mirrors Path B's separation of concerns (media-ingest-repository.ts,
// rights-evidence-repository.ts) but never sets rights_hold = 0 itself --
// per the program's core safety rule, a member's own attestation is real
// evidence worth recording, but publish approval is a decision only an
// admin (Bill Hunter) may make. commitMemberPhotoSubmission always inserts
// media_assets with the column default (rights_hold = 1); an admin later
// reviews the pending member_submissions row and, if they agree, records a
// rights_evidence conclusion the same way Path B does -- at which point
// reconcile-photos-rights-from-media-assets.mjs (#3598) is what actually
// surfaces it on the live site.

import { requireTables } from './d1';

export const MEMBER_PHOTO_SUBMISSION_TABLES = [
  'content_items',
  'member_submissions',
  'submitters',
  'media_assets',
] as const;

export async function requireMemberPhotoSubmissionTables(db: unknown) {
  return requireTables(db, [...MEMBER_PHOTO_SUBMISSION_TABLES]);
}

export type CreditPreference = 'public_credit' | 'anonymous' | 'private' | 'custom';

export type CommitMemberPhotoSubmissionInput = {
  submitterEmail: string;
  submitterName: string;
  ownershipStatement: string;
  permissionStatement: string;
  creditPreference: CreditPreference;
  customCreditLine?: string | null;
  caption?: string | null;
  mediaUid: string;
  b2Key: string;
  size: number;
  etag?: string | null;
};

export type CommitMemberPhotoSubmissionResult = {
  contentItemId: number;
  candidateId: string;
  memberSubmissionId: number;
  mediaUid: string;
  b2Key: string;
  alreadyExisted: boolean;
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

// Idempotent on mediaUid (derived from the content checksum): a retried
// upload of identical bytes re-links to the same media_assets row rather
// than creating a duplicate. Always inserts media_assets with rights_hold
// left at its column default (held) -- this function never clears it.
export async function commitMemberPhotoSubmission(
  db: any,
  input: CommitMemberPhotoSubmissionInput,
): Promise<CommitMemberPhotoSubmissionResult> {
  const submitterId = await findOrCreateSubmitter(db, {
    email: input.submitterEmail,
    name: input.submitterName,
  });

  const candidateId = `member-photo-${input.mediaUid}`;
  const title = input.caption?.trim() || `Member photo from ${input.submitterName}`;
  const summary = input.caption?.trim() || 'Photo submitted by a club member for rights review.';

  const insertResult = await db
    .prepare(
      `INSERT INTO media_assets (media_uid, b2_key, b2_file_id, size, etag)
       VALUES (?, ?, NULL, ?, ?)
       ON CONFLICT(media_uid) DO NOTHING`,
    )
    .bind(input.mediaUid, input.b2Key, input.size, input.etag ?? null)
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
      ) VALUES (?, 'member_submission', ?, NULL, ?, NULL, NULL,
        'member', 'photo', ?, NULL, NULL,
        'unknown', 'pending', 'pending', 'pending_review',
        'not_ready', NULL, 'donor_member', 'pending_review',
        ?, ?, NULL, 'normal', NULL, '{}')
       ON CONFLICT(candidate_id) DO NOTHING`,
    )
    .bind(
      candidateId,
      title,
      input.submitterName,
      summary,
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
      ) VALUES (?, ?, 'photo', ?, ?, ?, NULL, ?, NULL, 'pending', 1)
       ON CONFLICT(content_item_id) DO NOTHING`,
    )
    .bind(
      contentItemId,
      submitterId,
      input.ownershipStatement,
      input.permissionStatement,
      input.creditPreference,
      input.b2Key,
    )
    .run();

  const memberSubmission = await db
    .prepare('SELECT id FROM member_submissions WHERE content_item_id = ? LIMIT 1')
    .bind(contentItemId)
    .first();
  if (!memberSubmission) {
    throw new Error(`Failed to find/create member_submissions row for content_item_id=${contentItemId}`);
  }

  return {
    contentItemId,
    candidateId,
    memberSubmissionId: Number((memberSubmission as { id: number }).id),
    mediaUid: input.mediaUid,
    b2Key: input.b2Key,
    alreadyExisted,
  };
}
