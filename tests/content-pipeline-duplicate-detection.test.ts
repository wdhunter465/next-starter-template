import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { commitIngestedMedia } from '../functions/_lib/media-ingest-repository';
import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import {
  buildNearDuplicateIssueContent,
  findNearDuplicateMediaAssets,
  flagCandidateAsNearDuplicate,
  NEAR_DUPLICATE_HAMMING_THRESHOLD,
} from '../functions/_lib/content-pipeline-duplicate-detection';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          await statement.run();
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return statements.map(() => ({ success: true }));
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return {
            success: true,
            meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) },
          };
        },
      });
      return { bind: bound };
    },
  };
}

function minimalCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-501',
    input_stream: 'scheduled_discovery',
    title: 'File:GehrigCU.jpg',
    source_name: 'Wikimedia Commons',
    source_type: 'archive',
    content_type: 'photo',
    summary: 'Test summary',
    rights_status: 'unknown',
    source_trust_status: 'trusted',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

function freshDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyRepoMigrations(sqlite);
  return { sqlite, db: wrapSqliteAsD1(sqlite) };
}

async function seedIngestedCandidate(
  db: ReturnType<typeof wrapSqliteAsD1>,
  overrides: Partial<CandidateRecord>,
  input: { candidateId: number; mediaUid: string; b2Key: string; perceptualHash: string },
) {
  await upsertCandidate(db, minimalCandidate(overrides));
  await commitIngestedMedia(db, {
    candidateId: input.candidateId,
    candidateExternalId: overrides.candidate_id!,
    mediaUid: input.mediaUid,
    b2Key: input.b2Key,
    size: 100,
    etag: null,
    reviewer: 'Bill Hunter',
    conclusion: 'public_domain_confirmed',
  });
  await db
    .prepare('UPDATE media_assets SET perceptual_hash = ? WHERE media_uid = ?')
    .bind(input.perceptualHash, input.mediaUid)
    .run();
}

describe('findNearDuplicateMediaAssets (#3552 phase 4)', () => {
  it('finds a near-duplicate within the Hamming threshold and reports filenameMatches=true when titles match', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    // Same filename, hash differs by exactly 3 bits -- well within threshold.
    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000007',
      sourceFilename: 'File:GehrigCU.jpg',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedCandidateId).toBe('lgfc-gehrig-2026-501');
    expect(matches[0].distance).toBe(3);
    expect(matches[0].filenameMatches).toBe(true);
  });

  it('reports filenameMatches=false when a close hash has a different source filename (the ambiguous case)', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000007',
      sourceFilename: 'File:Some Other Photo.jpg',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].filenameMatches).toBe(false);
  });

  it('does not match a hash outside the threshold', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    // ffffffffffffffff differs from 0000000000000000 in all 64 bits.
    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: 'ffffffffffffffff',
      sourceFilename: 'File:GehrigCU.jpg',
    });

    expect(matches).toHaveLength(0);
  });

  it('respects a custom maxDistance override', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    const matches = await findNearDuplicateMediaAssets(
      db,
      { perceptualHash: '0000000000000007', sourceFilename: 'File:GehrigCU.jpg' },
      2, // distance is 3, threshold is 2 -- should NOT match
    );

    expect(matches).toHaveLength(0);
  });

  it('never matches the candidate against its own row (excludeMediaUid)', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000000',
      sourceFilename: 'File:GehrigCU.jpg',
      excludeMediaUid: 'sha256_aaaa',
    });

    expect(matches).toHaveLength(0);
  });

  it('sorts multiple matches by closest distance first', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:First.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_First.jpg', perceptualHash: '0000000000000000' },
    );
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-502', title: 'File:Second.jpg' },
      { candidateId: 2, mediaUid: 'sha256_bbbb', b2Key: 'LGFC_2_Second.jpg', perceptualHash: '0000000000000001' },
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000003',
      sourceFilename: 'File:Third.jpg',
    });

    expect(matches).toHaveLength(2);
    expect(matches[0].matchedCandidateId).toBe('lgfc-gehrig-2026-502'); // distance 2
    expect(matches[1].matchedCandidateId).toBe('lgfc-gehrig-2026-501'); // distance 3
  });

  it('the default threshold constant is exported and used when maxDistance is omitted', async () => {
    expect(NEAR_DUPLICATE_HAMMING_THRESHOLD).toBeGreaterThan(0);
  });

  it('carries the matched candidate source_url (#3761)', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      {
        candidate_id: 'lgfc-gehrig-2026-501',
        title: 'File:GehrigCU.jpg',
        source_url: 'https://www.flickr.com/photos/8852778@N08/5930600189',
      },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000007',
      sourceFilename: 'File:GehrigCU.jpg',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedSourceUrl).toBe('https://www.flickr.com/photos/8852778@N08/5930600189');
  });

  it('reports matchedSourceUrl as null when the matched candidate has no source_url', async () => {
    const { db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000007',
      sourceFilename: 'File:GehrigCU.jpg',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedSourceUrl).toBeNull();
  });
});

describe('buildNearDuplicateIssueContent (#3761)', () => {
  it('builds a title naming both candidates and a body with both source URLs', () => {
    const { title, body } = buildNearDuplicateIssueContent({
      candidateId: 'lgfc-gehrig-2026-505',
      candidateSourceUrl: 'https://www.flickr.com/photos/8852778@N08/5931156024',
      matchedCandidateId: 'lgfc-gehrig-2026-519',
      matchedSourceUrl: 'https://www.flickr.com/photos/8852778@N08/5930600189',
      distance: 7,
    });

    expect(title).toContain('lgfc-gehrig-2026-505');
    expect(title).toContain('lgfc-gehrig-2026-519');
    expect(body).toContain('lgfc-gehrig-2026-505');
    expect(body).toContain('lgfc-gehrig-2026-519');
    expect(body).toContain('https://www.flickr.com/photos/8852778@N08/5931156024');
    expect(body).toContain('https://www.flickr.com/photos/8852778@N08/5930600189');
    expect(body).toContain('7/64');
    expect(body).toContain('- [ ] Confirm whether these are the same photo.');
  });

  it('falls back to "unknown" for a missing source_url rather than "null"', () => {
    const { body } = buildNearDuplicateIssueContent({
      candidateId: 'lgfc-gehrig-2026-505',
      candidateSourceUrl: null,
      matchedCandidateId: 'lgfc-gehrig-2026-519',
      matchedSourceUrl: null,
      distance: 3,
    });

    expect(body).not.toContain('null');
    expect(body).toContain('unknown');
  });
});

describe('flagCandidateAsNearDuplicate (#3552 phase 4)', () => {
  it('sets duplicate_of and bumps review_priority to high, and records a duplicate_flagged moderation event', async () => {
    const { sqlite, db } = freshDb();
    await seedIngestedCandidate(
      db,
      { candidate_id: 'lgfc-gehrig-2026-501', title: 'File:GehrigCU.jpg' },
      { candidateId: 1, mediaUid: 'sha256_aaaa', b2Key: 'LGFC_1_GehrigCU.jpg', perceptualHash: '0000000000000000' },
    );
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-502', title: 'File:GehrigCU (duplicate upload).jpg' }),
    );

    const matches = await findNearDuplicateMediaAssets(db, {
      perceptualHash: '0000000000000007',
      sourceFilename: 'File:GehrigCU (duplicate upload).jpg',
    });
    expect(matches).toHaveLength(1);

    await flagCandidateAsNearDuplicate(db, 'lgfc-gehrig-2026-502', matches);

    const row = sqlite
      .prepare('SELECT duplicate_of, review_priority FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-502') as { duplicate_of: string; review_priority: string };
    expect(row.duplicate_of).toBe('lgfc-gehrig-2026-501');
    expect(row.review_priority).toBe('high');

    // upsertCandidate itself already wrote a 'review_state_change'
    // "candidate registry create" moderation event for this content_item
    // when the row was first inserted -- moderation_events is an
    // append-only audit trail, so filter to the specific event this test
    // cares about rather than assuming only one row exists.
    const event = sqlite
      .prepare(
        `SELECT event_type, actor, to_state, notes FROM moderation_events
         WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)
           AND event_type = 'duplicate_flagged'`,
      )
      .get('lgfc-gehrig-2026-502') as { event_type: string; actor: string; to_state: string; notes: string };
    expect(event.event_type).toBe('duplicate_flagged');
    expect(event.actor).toBe('system:perceptual-hash');
    expect(event.to_state).toBe('high');
    expect(event.notes).toContain('lgfc-gehrig-2026-501');
    expect(event.notes).toContain('distance=3/64');
  });

  it('is a no-op when there are no matches', async () => {
    const { sqlite, db } = freshDb();
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-501' }));

    await flagCandidateAsNearDuplicate(db, 'lgfc-gehrig-2026-501', []);

    const row = sqlite
      .prepare('SELECT duplicate_of, review_priority FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-501') as { duplicate_of: string | null; review_priority: string };
    expect(row.duplicate_of).toBeNull();
    expect(row.review_priority).toBe('normal');
  });
});
