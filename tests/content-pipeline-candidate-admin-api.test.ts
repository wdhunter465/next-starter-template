import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  parseCandidateListQuery,
  parseCandidateReviewRequest,
} from '../functions/_lib/content-pipeline-candidate-admin';
import {
  updateCandidateReviewState,
  upsertCandidate,
} from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { onRequestGet as candidatesGet } from '../functions/api/admin/content-pipeline/candidates/index';
import { onRequestPost as candidateReviewPost } from '../functions/api/admin/content-pipeline/candidates/review';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

function moderationEventsForCandidate(sqlite: DatabaseSync, candidateId: string) {
  return sqlite
    .prepare(
      `SELECT me.event_type, me.actor, me.from_state, me.to_state, me.notes
       FROM moderation_events me
       JOIN content_items ci ON ci.id = me.content_item_id
       WHERE ci.candidate_id = ?
       ORDER BY me.id ASC`,
    )
    .all(candidateId) as Array<{
    event_type: string;
    actor: string | null;
    from_state: string | null;
    to_state: string | null;
    notes: string | null;
  }>;
}

function minimalCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-999',
    input_stream: 'admin_seed',
    title: 'Test candidate',
    source_name: 'LGFC Operator',
    source_type: 'operator',
    content_type: 'story',
    summary: 'Test summary',
    rights_status: 'unknown',
    source_trust_status: 'pending',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    created_at: '2026-07-05T16:00:00.000Z',
    updated_at: '2026-07-05T16:00:00.000Z',
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
          stmt.run(...args);
          return { success: true };
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
          stmt.run();
          return { success: true };
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

function publicApiFiles(): string[] {
  const apiRoot = path.join(process.cwd(), 'functions/api');
  const results: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'admin') {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
  }

  walk(apiRoot);
  return results;
}

function importsProtectedModule(source: string, moduleName: string): boolean {
  const patterns = [
    new RegExp(`\\bfrom\\s+['"][^'"]*${moduleName}['"]`, 'm'),
    new RegExp(`\\bimport\\s*\\(\\s*['"][^'"]*${moduleName}['"]`, 'm'),
    new RegExp(`\\bexport\\s+[^;\\n]*\\bfrom\\s+['"][^'"]*${moduleName}['"]`, 'm'),
  ];
  return patterns.some((pattern) => pattern.test(source));
}

describe('content pipeline candidate admin API (#2310)', () => {
  it('parses list query filters and rejects invalid values', () => {
    const valid = parseCandidateListQuery(
      new URL('https://example.com/api/admin/content-pipeline/candidates?review_status=pending_review&limit=10'),
    );
    expect(valid.ok).toBe(true);

    const invalid = parseCandidateListQuery(
      new URL('https://example.com/api/admin/content-pipeline/candidates?review_status=not_real'),
    );
    expect(invalid.ok).toBe(false);
  });

  it('parses review requests and rejects invalid candidate_id values', () => {
    const valid = parseCandidateReviewRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      review_status: 'approved_internal_reference',
    });
    expect(valid.ok).toBe(true);

    const invalid = parseCandidateReviewRequest({
      candidate_id: 'bad-id',
      review_status: 'approved_internal_reference',
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toContain('lgfc-gehrig-YYYY-NNN');
    }
  });

  it('returns 401 without admin authorization', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await candidatesGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/candidates', null),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'Not authenticated' });
  });

  it('returns 503 when the D1 binding is missing', async () => {
    const response = await candidatesGet({
      env: {},
      request: adminGetRequest('/api/admin/content-pipeline/candidates'),
    });

    expect(response.status).toBe(503);
  });

  it('lists and fetches candidates through admin routes', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-801' }));
    await upsertCandidate(
      db,
      minimalCandidate({
        candidate_id: 'lgfc-gehrig-2026-802',
        review_status: 'approved_internal_reference',
      }),
    );

    const listResponse = await candidatesGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/candidates?review_status=approved_internal_reference'),
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.count).toBe(1);
    expect(listBody.candidates[0].candidate_id).toBe('lgfc-gehrig-2026-802');

    const getResponse = await candidatesGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/candidates?candidate_id=lgfc-gehrig-2026-801'),
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.candidate.candidate_id).toBe('lgfc-gehrig-2026-801');
  });

  it('returns 404 for missing candidates, 400 for malformed candidate_id, and 400 for invalid review payloads', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const malformed = await candidatesGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/candidates?candidate_id=bad-id'),
    });
    expect(malformed.status).toBe(400);

    const missing = await candidatesGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/candidates?candidate_id=lgfc-gehrig-2026-404'),
    });
    expect(missing.status).toBe(404);

    const invalidReview = await candidateReviewPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/review', {
        candidate_id: 'lgfc-gehrig-2026-404',
        review_status: 'not_a_valid_status',
      }),
    });
    expect(invalidReview.status).toBe(400);
  });

  it('rejects publication_status published on admin review updates', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const response = await candidateReviewPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/review', {
        candidate_id: 'lgfc-gehrig-2026-999',
        publication_status: 'published',
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('publication/conversion workflow');
  });

  it('applies allowed review-state updates through the admin review route', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const response = await candidateReviewPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/review', {
        candidate_id: 'lgfc-gehrig-2026-999',
        review_status: 'approved_internal_reference',
        rights_status: 'permission_needed',
        actor: 'operator@test',
        notes: 'Initial review',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.candidate.review_status).toBe('approved_internal_reference');
    expect(body.candidate.rights_status).toBe('permission_needed');

    const events = moderationEventsForCandidate(sqlite, 'lgfc-gehrig-2026-999');
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      event_type: 'review_state_change',
      notes: 'candidate registry create',
    });
    expect(events.slice(1).map((event) => event.event_type).sort()).toEqual(
      ['review_state_change', 'rights_update'].sort(),
    );
    expect(events[1].actor).toBe('operator@test');
    expect(JSON.parse(events[1].from_state || '{}')).toMatchObject({ review_status: 'pending_review' });
    expect(JSON.parse(events[1].to_state ?? '{}')).toMatchObject({
      review_status: 'approved_internal_reference',
    });
  });

  it('writes publication_prep and privacy_update event types for matching field changes', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    await updateCandidateReviewState(db, 'lgfc-gehrig-2026-999', {
      publication_status: 'draft_candidate',
      privacy_review_status: 'approved',
    });

    const events = moderationEventsForCandidate(sqlite, 'lgfc-gehrig-2026-999').filter(
      (event) => event.notes !== 'candidate registry create',
    );
    expect(events.map((event) => event.event_type).sort()).toEqual(
      ['privacy_update', 'publication_prep'].sort(),
    );
  });

  it('does not write moderation events when review-state update is a no-op', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const beforeCount = moderationEventsForCandidate(sqlite, 'lgfc-gehrig-2026-999').length;
    await updateCandidateReviewState(db, 'lgfc-gehrig-2026-999', {
      review_status: 'pending_review',
    });
    const afterCount = moderationEventsForCandidate(sqlite, 'lgfc-gehrig-2026-999').length;
    expect(afterCount).toBe(beforeCount);
  });

  it('audits candidate registry create with a single review_state_change row', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-880' }));

    const events = moderationEventsForCandidate(sqlite, 'lgfc-gehrig-2026-880');
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('review_state_change');
    expect(events[0].from_state).toBe('{}');
    expect(JSON.parse(events[0].to_state ?? '{}')).toMatchObject({
      candidate_id: 'lgfc-gehrig-2026-880',
      review_status: 'pending_review',
    });
  });

  it('does not expose candidate repository routes on public API surfaces', () => {
    for (const filePath of publicApiFiles()) {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(importsProtectedModule(source, 'content-pipeline-candidate-repository')).toBe(false);
      expect(importsProtectedModule(source, 'content-pipeline-candidate-admin')).toBe(false);
    }
  });

  it('registers admin routes only under /api/admin/content-pipeline', () => {
    expect(fs.existsSync('functions/api/admin/content-pipeline/candidates/index.ts')).toBe(true);
    expect(fs.existsSync('functions/api/admin/content-pipeline/candidates/review.ts')).toBe(true);
    expect(fs.existsSync('functions/api/content-pipeline/candidates.ts')).toBe(false);
  });
});
