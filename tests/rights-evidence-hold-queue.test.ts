// #3827: curator-facing hold queue -- listHoldQueue (repository) and
// GET /api/admin/content-pipeline/rights-evidence/queue (admin API).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { listHoldQueue, recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { onRequestGet as holdQueueGet } from '../functions/api/admin/content-pipeline/rights-evidence/queue';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

function minimalCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-999',
    input_stream: 'scheduled_discovery',
    title: 'Test candidate',
    source_name: 'Library of Congress',
    source_type: 'library',
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
    created_at: '2026-08-17T16:00:00.000Z',
    updated_at: '2026-08-17T16:00:00.000Z',
    ...overrides,
  };
}

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
    async exec(sql: string) {
      sqlite.exec(sql);
    },
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
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          const info = stmt.run();
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      };
    },
  };
}

function adminGetRequest(path: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

describe('listHoldQueue (#3827)', () => {
  it('includes a candidate whose only evidence row defaults to usage_decision hold', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'Unrecognized license template -- queued for human review.',
    });

    const queue = await listHoldQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0].candidate_id).toBe('lgfc-gehrig-2026-999');
    expect(queue[0].latest_evidence.usage_decision).toBe('hold');
  });

  it('excludes a candidate once its most recent row resolves the hold', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'Unrecognized license template -- queued for human review.',
    });

    let queue = await listHoldQueue(db);
    expect(queue).toHaveLength(1);

    // Resolving means a NEW row, never mutating the held one (append-only).
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'other',
      reviewer: 'Bill',
      conclusion_rationale: 'Verified against Commons upload history -- Public Domain Mark 1.0 confirmed.',
      usage_decision: 'permit',
    });

    queue = await listHoldQueue(db);
    expect(queue).toHaveLength(0);
  });

  it('excludes a candidate with zero evidence rows (no decision yet is not "hold")', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(db, minimalCandidate());

    const queue = await listHoldQueue(db);
    expect(queue).toHaveLength(0);
  });

  it('orders held candidates oldest-first by their latest evidence row', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const older = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-001' }));
    const newer = await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-002', title: 'Newer candidate' }),
    );

    await recordRightsEvidence(db, {
      content_item_id: older.id,
      evidence_type: 'commons_license',
      evidence_text: 'Older hold.',
      evidence_metadata: {},
    });
    // Force distinct recorded_at ordering deterministically rather than relying on wall-clock timing between statements.
    await sqlite.exec(`UPDATE rights_evidence SET recorded_at = '2026-08-01T00:00:00.000Z' WHERE content_item_id = ${older.id}`);

    await recordRightsEvidence(db, {
      content_item_id: newer.id,
      evidence_type: 'commons_license',
      evidence_text: 'Newer hold.',
    });
    await sqlite.exec(`UPDATE rights_evidence SET recorded_at = '2026-08-20T00:00:00.000Z' WHERE content_item_id = ${newer.id}`);

    const queue = await listHoldQueue(db);
    expect(queue.map((q) => q.candidate_id)).toEqual(['lgfc-gehrig-2026-001', 'lgfc-gehrig-2026-002']);
  });

  it('surfaces a candidate again if a later row re-holds it after an earlier deny', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());

    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'Initial hold.',
    });

    // Denied -- should not appear in the queue.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'other',
      reviewer: 'Bill',
      conclusion_rationale: 'License template did not actually apply to this crop -- denied.',
      usage_decision: 'deny',
    });
    let queue = await listHoldQueue(db);
    expect(queue).toHaveLength(0);

    // New evidence reopens the question -- back on hold, not stuck denied
    // forever, and the queue reads only the latest row, not the denial.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'A different, higher-resolution source file was found for the same item.',
    });
    queue = await listHoldQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0].latest_evidence.usage_decision).toBe('hold');
  });
});

describe('GET /api/admin/content-pipeline/rights-evidence/queue (#3827)', () => {
  it('returns 401 without admin authorization', async () => {
    const response = await holdQueueGet({
      env: { DB: {} },
      request: adminGetRequest('/api/admin/content-pipeline/rights-evidence/queue', null),
    });

    expect(response.status).toBe(401);
  });

  it('returns held items to an authenticated admin', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'Unrecognized license template -- queued for human review.',
      evidence_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    });

    const response = await holdQueueGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/rights-evidence/queue'),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.items[0].candidate_id).toBe('lgfc-gehrig-2026-999');
    expect(body.items[0].latest_evidence.usage_decision).toBe('hold');
    expect(body.items[0].latest_evidence.evidence_url).toBe('https://commons.wikimedia.org/wiki/File:Example.jpg');
  });
});
