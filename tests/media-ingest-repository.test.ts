import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { commitIngestedMedia } from '../functions/_lib/media-ingest-repository';
import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';

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

describe('commitIngestedMedia dedup-linking correctness (#3716 phase 2a)', () => {
  it('links a new mediaUid using its own b2Key on first ingest', async () => {
    const { sqlite, db } = freshDb();
    await upsertCandidate(db, minimalCandidate());

    const result = await commitIngestedMedia(db, {
      candidateId: 1,
      candidateExternalId: 'lgfc-gehrig-2026-501',
      mediaUid: 'sha256_aaaa',
      b2Key: 'LGFC_1_GehrigCU.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
    });

    expect(result.alreadyExisted).toBe(false);
    expect(result.b2Key).toBe('LGFC_1_GehrigCU.jpg');

    const row = sqlite
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-501') as { media_asset_id: string };
    expect(row.media_asset_id).toBe('b2://LGFC_1_GehrigCU.jpg');
  });

  it('links a dedup-hit candidate to the ORIGINAL row\'s real b2Key, not its own freshly-computed one', async () => {
    const { sqlite, db } = freshDb();
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-501' }));
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-502', title: 'File:GehrigCU (duplicate upload).jpg' }),
    );

    // First candidate ingests real bytes and actually writes this key to B2.
    const first = await commitIngestedMedia(db, {
      candidateId: 1,
      candidateExternalId: 'lgfc-gehrig-2026-501',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_1_GehrigCU.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
    });
    expect(first.alreadyExisted).toBe(false);

    // A second, different candidate resolves to the SAME bytes (identical
    // media_uid) but computes a DIFFERENT b2Key of its own (different
    // content_items.id embedded in the key). Nothing is actually written to
    // B2 under this second key -- the caller skips the PUT on a media_uid
    // dedup hit (see ingest.ts / ingest-batch.mjs).
    const second = await commitIngestedMedia(db, {
      candidateId: 2,
      candidateExternalId: 'lgfc-gehrig-2026-502',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_2_GehrigCU_duplicate_upload.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
    });

    expect(second.alreadyExisted).toBe(true);
    // Must resolve to the key that was actually written to B2 by the first
    // candidate, not the second candidate's own never-written key.
    expect(second.b2Key).toBe('LGFC_1_GehrigCU.jpg');

    const secondRow = sqlite
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-502') as { media_asset_id: string };
    expect(secondRow.media_asset_id).toBe('b2://LGFC_1_GehrigCU.jpg');

    // Only one media_assets row exists, and it still points at the b2_key
    // that was actually written.
    const mediaAssetCount = sqlite
      .prepare('SELECT COUNT(*) AS count FROM media_assets WHERE media_uid = ?')
      .get('sha256_identical_bytes') as { count: number };
    expect(mediaAssetCount.count).toBe(1);
    const mediaAssetRow = sqlite
      .prepare('SELECT b2_key FROM media_assets WHERE media_uid = ?')
      .get('sha256_identical_bytes') as { b2_key: string };
    expect(mediaAssetRow.b2_key).toBe('LGFC_1_GehrigCU.jpg');
  });

  it('opportunistically backfills perceptual_hash on a dedup hit when the existing row predates it (#3552 phase 4)', async () => {
    const { sqlite, db } = freshDb();
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-501' }));
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-502', title: 'File:GehrigCU (duplicate upload).jpg' }),
    );

    // First candidate ingests without a computed hash (as if written before
    // phase 4 existed) -- media_assets.perceptual_hash stays NULL.
    await commitIngestedMedia(db, {
      candidateId: 1,
      candidateExternalId: 'lgfc-gehrig-2026-501',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_1_GehrigCU.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
    });

    // A second candidate resolves to the SAME bytes (media_uid dedup hit)
    // and DID compute a hash -- INSERT OR IGNORE alone would silently drop
    // it since the row already exists; commitIngestedMedia must backfill it.
    const second = await commitIngestedMedia(db, {
      candidateId: 2,
      candidateExternalId: 'lgfc-gehrig-2026-502',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_2_GehrigCU_duplicate_upload.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
      perceptualHash: 'abcdef0123456789',
    });
    expect(second.alreadyExisted).toBe(true);

    const mediaAssetRow = sqlite
      .prepare('SELECT perceptual_hash FROM media_assets WHERE media_uid = ?')
      .get('sha256_identical_bytes') as { perceptual_hash: string };
    expect(mediaAssetRow.perceptual_hash).toBe('abcdef0123456789');
  });

  it('never overwrites an already-hashed row on a dedup hit, even if the new caller computed a different hash', async () => {
    const { sqlite, db } = freshDb();
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-501' }));
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-502', title: 'File:GehrigCU (duplicate upload).jpg' }),
    );

    await commitIngestedMedia(db, {
      candidateId: 1,
      candidateExternalId: 'lgfc-gehrig-2026-501',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_1_GehrigCU.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
      perceptualHash: '0000000000000000',
    });

    await commitIngestedMedia(db, {
      candidateId: 2,
      candidateExternalId: 'lgfc-gehrig-2026-502',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_2_GehrigCU_duplicate_upload.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
      perceptualHash: 'ffffffffffffffff',
    });

    const mediaAssetRow = sqlite
      .prepare('SELECT perceptual_hash FROM media_assets WHERE media_uid = ?')
      .get('sha256_identical_bytes') as { perceptual_hash: string };
    expect(mediaAssetRow.perceptual_hash).toBe('0000000000000000');
  });

  it('fails closed instead of trusting the caller-supplied b2Key when the existing row cannot be read back on a dedup hit', async () => {
    const { db } = freshDb();
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-501' }));
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-502', title: 'File:GehrigCU (duplicate upload).jpg' }),
    );

    await commitIngestedMedia(db, {
      candidateId: 1,
      candidateExternalId: 'lgfc-gehrig-2026-501',
      mediaUid: 'sha256_identical_bytes',
      b2Key: 'LGFC_1_GehrigCU.jpg',
      size: 100,
      etag: null,
      reviewer: 'Bill Hunter',
      conclusion: 'public_domain_confirmed',
    });

    // Simulate the SELECT-back-on-dedup-hit failing to find the row (e.g. a
    // read-replica lag or driver bug) by stubbing just that one query to
    // return null while every other query still hits the real database.
    const flakyDb = {
      prepare(sql: string) {
        const real = db.prepare(sql);
        if (sql.includes('SELECT b2_key, perceptual_hash FROM media_assets')) {
          return { bind: () => ({ async first() { return null; } }) };
        }
        return real;
      },
    };

    await expect(
      commitIngestedMedia(flakyDb, {
        candidateId: 2,
        candidateExternalId: 'lgfc-gehrig-2026-502',
        mediaUid: 'sha256_identical_bytes',
        b2Key: 'LGFC_2_GehrigCU_duplicate_upload.jpg',
        size: 100,
        etag: null,
        reviewer: 'Bill Hunter',
        conclusion: 'public_domain_confirmed',
      }),
    ).rejects.toThrow(/b2_key could not be read back/);
  });
});
