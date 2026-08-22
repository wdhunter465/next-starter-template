import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { parseRecordRightsEvidenceRequest } from '../functions/_lib/rights-evidence-admin';
import {
  getCurrentConclusionForCandidate,
  listRightsEvidenceForCandidate,
  recordRightsEvidence,
} from '../functions/_lib/rights-evidence-repository';
import { onRequestGet as rightsEvidenceGet, onRequestPost as rightsEvidencePost } from '../functions/api/admin/content-pipeline/rights-evidence/index';
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

function adminPostRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('rights evidence request parsing (#3552)', () => {
  it('rejects an invalid candidate_id', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'bad-id',
      evidence_type: 'loc_statement',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown evidence_type', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'not_a_real_type',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown conclusion value', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'probably_fine',
    });
    expect(result.ok).toBe(false);
  });

  it('requires reviewer and rationale whenever a conclusion is recorded', () => {
    const missingReviewer = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
    });
    expect(missingReviewer.ok).toBe(false);

    const missingRationale = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
    });
    expect(missingRationale.ok).toBe(false);

    const complete = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
    });
    expect(complete.ok).toBe(true);
  });

  it('accepts evidence without a conclusion (metadata-only research record)', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'openverse_license',
      evidence_text: 'CC0 per Openverse record',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.conclusion).toBeUndefined();
    }
  });
});

describe('rights evidence repository + admin API (#3552)', () => {
  it('records evidence as an append-only trail and tracks the current conclusion', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());

    // First pass: metadata-only research record, no conclusion yet.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      evidence_text: 'No known restrictions on publication.',
      evidence_url: 'https://loc.gov/item/example',
    });

    expect(await getCurrentConclusionForCandidate(db, candidate.id)).toBeNull();

    // Second pass: reviewer records a conclusion.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'pre_1931_publication',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'Confirmed 1928 newspaper publication, US, no URAA restoration.',
    });

    const trail = await listRightsEvidenceForCandidate(db, candidate.id);
    expect(trail).toHaveLength(2);
    // Most recent first.
    expect(trail[0].conclusion).toBe('public_domain_confirmed');
    expect(trail[1].conclusion).toBeNull();

    const current = await getCurrentConclusionForCandidate(db, candidate.id);
    expect(current?.conclusion).toBe('public_domain_confirmed');
    expect(current?.reviewer).toBe('Bill');
  });

  it('returns 401 without admin authorization', async () => {
    const response = await rightsEvidenceGet({
      env: { DB: {} },
      request: adminGetRequest(
        '/api/admin/content-pipeline/rights-evidence?candidate_id=lgfc-gehrig-2026-999',
        null,
      ),
    });

    expect(response.status).toBe(401);
  });

  it('rejects recording evidence for a candidate that does not exist', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-404',
        evidence_type: 'loc_statement',
      }),
    });

    expect(response.status).toBe(404);
  });

  it('records evidence through the admin API and resolves source_domain to source_id', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const postResponse = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-999',
        evidence_type: 'loc_statement',
        evidence_text: 'No known restrictions on publication.',
        source_domain: 'loc.gov',
      }),
    });

    expect(postResponse.status).toBe(201);
    const postBody = await postResponse.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.evidence.source_id).toEqual(expect.any(Number));

    const getResponse = await rightsEvidenceGet({
      env: { DB: db },
      request: adminGetRequest(
        '/api/admin/content-pipeline/rights-evidence?candidate_id=lgfc-gehrig-2026-999',
      ),
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.evidence).toHaveLength(1);
    expect(getBody.current_conclusion).toBeNull();
  });

  it('rejects an unknown source_domain', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const response = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-999',
        evidence_type: 'loc_statement',
        source_domain: 'not-a-real-source.example',
      }),
    });

    expect(response.status).toBe(400);
  });
});
