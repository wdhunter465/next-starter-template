// #3552 phase 4: cross-source duplicate detection via perceptual hash. The
// source_url dedupe guard (phase 1, content-pipeline-candidate-import.ts)
// only catches the SAME source_url appearing twice; it cannot catch the
// same real-world photo found on two different platforms (two different
// source_urls, two different content bytes -- different compression/crop/
// resolution -- therefore two different media_uid content hashes too).
// Perceptual hash closes that gap, but it is a similarity SIGNAL, not
// proof: two genuinely different photos can land within the same distance
// as two copies of the same photo. This module never auto-rejects or
// auto-merges a candidate on a hash match -- it always defers to a human,
// via `duplicate_of` + a `duplicate_flagged` moderation_events row, with
// the matched candidate's source filename surfaced as the tiebreaker a
// reviewer needs (a matching filename is a much stronger signal than a
// close hash alone).

import { sanitizeSourceFilenameForKey } from './content-pipeline-media-key';
import { hammingDistanceHex } from './perceptual-hash';

// A 64-bit dHash differing by more than ~10 of its 64 bits is very rarely
// the same photo (per general dHash-literature guidance); this stays
// deliberately generous (favors false positives, i.e. more human review,
// over false negatives, i.e. a real duplicate slipping through unflagged).
export const NEAR_DUPLICATE_HAMMING_THRESHOLD = 10;

export type NearDuplicateMatch = {
  matchedCandidateId: string;
  matchedContentItemId: number;
  matchedTitle: string | null;
  distance: number;
  filenameMatches: boolean;
};

export async function findNearDuplicateMediaAssets(
  db: any,
  input: { perceptualHash: string; sourceFilename: string; excludeMediaUid?: string },
  maxDistance: number = NEAR_DUPLICATE_HAMMING_THRESHOLD,
): Promise<NearDuplicateMatch[]> {
  const existing = await db
    .prepare(
      `SELECT media_uid, b2_key, perceptual_hash FROM media_assets
       WHERE perceptual_hash IS NOT NULL AND media_uid != ?`,
    )
    .bind(input.excludeMediaUid ?? '')
    .all();

  const rows = (existing.results ?? []) as Array<{ media_uid: string; b2_key: string; perceptual_hash: string }>;
  const candidateNormalizedFilename = sanitizeSourceFilenameForKey(input.sourceFilename);

  // Compute distances in-memory first, so the (usually far more expensive)
  // content_items lookup only ever runs for rows that actually matter --
  // and runs once, not once per matching row (avoiding an N+1 query
  // pattern that would scale poorly as media_assets grows).
  const withinThreshold = rows
    .map((row) => ({ row, distance: hammingDistanceHex(input.perceptualHash, row.perceptual_hash) }))
    .filter(({ distance }) => distance <= maxDistance);

  if (withinThreshold.length === 0) {
    return [];
  }

  const mediaAssetIds = withinThreshold.map(({ row }) => `b2://${row.b2_key}`);
  const placeholders = mediaAssetIds.map(() => '?').join(', ');
  const contentItemsResult = await db
    .prepare(`SELECT id, candidate_id, title, media_asset_id FROM content_items WHERE media_asset_id IN (${placeholders})`)
    .bind(...mediaAssetIds)
    .all();
  const contentItemsByMediaAssetId = new Map(
    ((contentItemsResult.results ?? []) as Array<{ id: number; candidate_id: string; title: string | null; media_asset_id: string }>).map(
      (item) => [item.media_asset_id, item],
    ),
  );

  const matches: NearDuplicateMatch[] = [];
  for (const { row, distance } of withinThreshold) {
    const contentItem = contentItemsByMediaAssetId.get(`b2://${row.b2_key}`);
    if (!contentItem) continue; // media_assets row not (yet) linked to any content_items row

    const matchedNormalizedFilename = sanitizeSourceFilenameForKey(String(contentItem.title ?? ''));

    matches.push({
      matchedCandidateId: String(contentItem.candidate_id),
      matchedContentItemId: Number(contentItem.id),
      matchedTitle: contentItem.title ? String(contentItem.title) : null,
      distance,
      filenameMatches: matchedNormalizedFilename === candidateNormalizedFilename,
    });
  }

  // Closest match first -- the strongest signal belongs at the top of what
  // a reviewer reads.
  matches.sort((a, b) => a.distance - b.distance);
  return matches;
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildNearDuplicateFlagNotes(matches: NearDuplicateMatch[]): string {
  const lines = matches.map((match) => {
    const filenameNote = match.filenameMatches
      ? 'filename matches (strong duplicate signal)'
      : 'filename differs (may be a distinct photo -- verify before merging)';
    return `candidate_id=${match.matchedCandidateId} distance=${match.distance}/64 title=${JSON.stringify(match.matchedTitle)} ${filenameNote}`;
  });
  return `Perceptual hash flagged ${matches.length} near-duplicate candidate(s):\n${lines.join('\n')}`;
}

// Writes the review-visible side effects of a hash match: content_items
// gets its `duplicate_of` pointer (the closest match) and its
// review_priority bumped so it doesn't sit unnoticed behind normal-priority
// items, plus a durable moderation_events row with the full match list so a
// reviewer sees every close candidate, not just the top one.
export async function flagCandidateAsNearDuplicate(
  db: any,
  candidateId: string,
  matches: NearDuplicateMatch[],
): Promise<void> {
  if (matches.length === 0) return;

  const closest = matches[0];
  const notes = buildNearDuplicateFlagNotes(matches);

  await db
    .prepare(
      `UPDATE content_items
       SET duplicate_of = ?, review_priority = 'high', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE candidate_id = ?`,
    )
    .bind(closest.matchedCandidateId, candidateId)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_events (content_item_id, event_type, actor, from_state, to_state, notes)
       SELECT id, 'duplicate_flagged', 'system:perceptual-hash', review_priority, 'high', ${sqlString(notes)}
       FROM content_items WHERE candidate_id = ?`,
    )
    .bind(candidateId)
    .run();
}
