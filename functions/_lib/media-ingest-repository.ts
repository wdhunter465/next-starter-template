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
  // #3552 phase 4: the caller computes this (see perceptual-hash.ts) since
  // hashing needs the actual decoded image, which this function never
  // touches -- it only ever receives already-fetched bytes' metadata.
  // Optional so existing callers/tests that don't care about cross-source
  // dedupe keep working unchanged.
  perceptualHash?: string | null;
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
        media_uid, b2_key, b2_file_id, size, etag, perceptual_hash,
        rights_hold, rights_hold_reason, rights_hold_set_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    )
    .bind(
      input.mediaUid,
      input.b2Key,
      input.b2FileId ?? null,
      input.size,
      input.etag ?? null,
      input.perceptualHash ?? null,
      `rights_evidence_conclusion:${input.conclusion} reviewer:${input.reviewer}`,
    )
    .run();

  const alreadyExisted = Number((insertResult as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0;

  // #3716 phase 2a: the B2 key is no longer a pure function of content bytes
  // (it now embeds content_items.id, see content-pipeline-media-key.ts), so
  // two different candidates resolving to identical bytes compute two
  // DIFFERENT keys. On a dedup hit (alreadyExisted), input.b2Key is this
  // caller's own freshly-computed key -- not necessarily what was actually
  // written to B2 by whichever candidate ingested these bytes first. Link
  // against the existing row's real, already-correct b2_key instead, or a
  // content_item could end up pointing at a B2 object that was never
  // written.
  let effectiveB2Key = input.b2Key;
  if (alreadyExisted) {
    const existing = await db
      .prepare(`SELECT b2_key FROM media_assets WHERE media_uid = ? LIMIT 1`)
      .bind(input.mediaUid)
      .first();
    // media_assets.b2_key is NOT NULL -- an INSERT OR IGNORE dedup hit means
    // a row for this mediaUid was already committed, so failing to read its
    // b2_key back is a real invariant violation, not a case to paper over by
    // silently trusting the caller's never-written key.
    if (!existing?.b2_key) {
      throw new Error(
        `commitIngestedMedia: media_assets row for media_uid ${input.mediaUid} reported alreadyExisted but its b2_key could not be read back`,
      );
    }
    effectiveB2Key = existing.b2_key as string;
  }

  await updateCandidateMediaReferences(
    db,
    input.candidateExternalId,
    { media_asset_id: `b2://${effectiveB2Key}` },
    { actor: input.reviewer, notes: `#3552 ingestion: linked media_uid ${input.mediaUid}` },
  );

  return { mediaUid: input.mediaUid, b2Key: effectiveB2Key, alreadyExisted };
}
