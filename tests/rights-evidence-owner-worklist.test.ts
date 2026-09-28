// #4402: automation-first owner-outreach worklist -- listOwnerContactWorklist
// (repository) and GET /api/admin/content-pipeline/rights-evidence/owner-worklist
// (admin API). Each row carries source, copyright status as stated, and
// contact information together; the existing usage_decision column is the
// Yes/No/pending response column -- recording an owner's actual response
// goes through the existing rights-evidence API, same as every other rights
// decision in this pipeline.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { listOwnerContactWorklist, recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { onRequestGet as ownerWorklistGet } from '../functions/api/admin/content-pipeline/rights-evidence/owner-worklist';
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

describe('listOwnerContactWorklist (#4402)', () => {
  it('returns one row per candidate carrying source, copyright status as stated, and contact info', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(
      db,
      minimalCandidate({
        candidate_id: 'lgfc-gehrig-2026-001',
        source_name: 'Wikimedia Commons',
        source_owner: 'Jane Photographer',
        rights_status: 'unknown',
      }),
    );
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'License template: All Rights Reserved.',
      contact_info: 'https://commons.wikimedia.org/wiki/User_talk:JanePhotographer',
    });

    const worklist = await listOwnerContactWorklist(db);

    expect(worklist).toHaveLength(1);
    expect(worklist[0]).toMatchObject({
      candidate_id: 'lgfc-gehrig-2026-001',
      source_name: 'Wikimedia Commons',
      source_owner: 'Jane Photographer',
      rights_status: 'unknown',
      copyright_status_as_stated: 'License template: All Rights Reserved.',
      contact_info: 'https://commons.wikimedia.org/wiki/User_talk:JanePhotographer',
      response: 'hold',
    });
  });

  it('reflects the latest recorded response once a curator records an owner\'s Yes/No answer', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-002', source_owner: 'Owner X', rights_status: 'unknown' }),
    );
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'commons_license',
      evidence_text: 'License template: unclear.',
    });

    let worklist = await listOwnerContactWorklist(db);
    expect(worklist[0].response).toBe('hold');

    // Owner responded "yes" -- recorded as a new row, append-only, same as
    // every other rights decision in this pipeline.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'other',
      reviewer: 'Bill',
      conclusion: 'permission_granted',
      conclusion_rationale: 'Owner replied via email 2026-09-28: granted permission with credit.',
      channel: 'website',
      usage_decision: 'permit',
    });

    worklist = await listOwnerContactWorklist(db);
    // rights_status on content_items is untouched by this call (promoting it
    // is the existing batch-rights-approval flow's job, unchanged here), so
    // the item still surfaces -- but with its latest response visible.
    expect(worklist[0].response).toBe('permit');
  });

  it('excludes already-resolved rights statuses (auto-confirmed public domain, granted, restricted, blocked)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-010', source_owner: 'Owner A', rights_status: 'public_domain_candidate' }),
    );
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-011', source_owner: 'Owner B', rights_status: 'permission_granted' }),
    );
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-012', source_owner: 'Owner C', rights_status: 'blocked' }),
    );
    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-013', source_owner: 'Owner D', rights_status: 'copyright_restricted' }),
    );

    const worklist = await listOwnerContactWorklist(db);
    expect(worklist).toHaveLength(0);
  });

  it('buckets a candidate with no captured owner under "Unknown owner" and no evidence row as null response', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-020', rights_status: 'unknown' }));

    const worklist = await listOwnerContactWorklist(db);
    expect(worklist).toHaveLength(1);
    expect(worklist[0].source_owner).toBe('Unknown owner');
    expect(worklist[0].response).toBeNull();
    expect(worklist[0].copyright_status_as_stated).toBeNull();
  });

  it('excludes admin_seed / non-scheduled_discovery candidates', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(
      db,
      minimalCandidate({
        candidate_id: 'lgfc-gehrig-2026-030',
        input_stream: 'admin_seed',
        source_owner: 'Owner E',
        rights_status: 'unknown',
      }),
    );

    const worklist = await listOwnerContactWorklist(db);
    expect(worklist).toHaveLength(0);
  });
});

describe('GET /api/admin/content-pipeline/rights-evidence/owner-worklist (#4402)', () => {
  it('returns 401 without admin authorization', async () => {
    const response = await ownerWorklistGet({
      env: { DB: {} },
      request: adminGetRequest('/api/admin/content-pipeline/rights-evidence/owner-worklist', null),
    });

    expect(response.status).toBe(401);
  });

  it('returns the owner worklist to an authenticated admin', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(
      db,
      minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-040', source_owner: 'Owner F', rights_status: 'unknown' }),
    );

    const response = await ownerWorklistGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/rights-evidence/owner-worklist'),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.items[0].candidate_id).toBe('lgfc-gehrig-2026-040');
    expect(body.items[0].source_owner).toBe('Owner F');
  });
});
