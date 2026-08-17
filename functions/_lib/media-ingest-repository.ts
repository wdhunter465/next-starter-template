// D1 commit for #3551 step 7 ("Commit metadata"): links an already-fetched,
// already-validated, already-B2-written original to its candidate. Callers
// (the ingestion endpoint) are responsible for everything upstream of this:
// requiring a recorded rights_evidence conclusion, source-URL allowlisting,
// content-type/size/magic-byte validation, and the actual B2 write.

import { updateCandidateMediaReferences } from './content-pipeline-candidate-repository';

export type CommitIngestedMediaInput = {
  candidateId: number;
  candidateExternalId: string;
  mediaUid: string;
  b2Key: string;
  b2FileId?: string | null;
  size: number;
  etag?: string | null;
  reviewer: string;
  conclusion: string;
};

export type CommitIngestedMediaResult = {
  mediaUid: string;
  b2Key: string;
  alreadyExisted: boolean;
};

// Idempotent: re-running with the same mediaUid (derived from the content
// checksum) is a no-op on media_assets and a safe re-link on content_items.
// Uses INSERT OR IGNORE rather than SELECT-then-INSERT so two concurrent
// ingests of the same bytes can't have the loser fail on the media_uid
// UNIQUE constraint -- both end up idempotently pointing at the same row.
export async function commitIngestedMedia(
  db: any,
  input: CommitIngestedMediaInput,
): Promise<CommitIngestedMediaResult> {
  const insertResult = await db
    .prepare(
      `INSERT OR IGNORE INTO media_assets (
        media_uid, b2_key, b2_file_id, size, etag,
        rights_hold, rights_hold_reason, rights_hold_set_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    )
    .bind(
      input.mediaUid,
      input.b2Key,
      input.b2FileId ?? null,
      input.size,
      input.etag ?? null,
      `rights_evidence_conclusion:${input.conclusion} reviewer:${input.reviewer}`,
    )
    .run();

  const alreadyExisted = Number((insertResult as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0;

  await updateCandidateMediaReferences(
    db,
    input.candidateExternalId,
    { media_asset_id: `b2://${input.b2Key}` },
    { actor: input.reviewer, notes: `#3552 ingestion: linked media_uid ${input.mediaUid}` },
  );

  return { mediaUid: input.mediaUid, b2Key: input.b2Key, alreadyExisted };
}
