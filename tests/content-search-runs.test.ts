import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  parseCompleteSearchRunRequest,
  parseStartSearchRunRequest,
} from '../functions/_lib/content-search-run-admin';
import {
  completeSearchRun,
  expireStaleRunningSearchRuns,
  getSearchRunByUid,
  heartbeatSearchRun,
  listSearchRuns,
  startSearchRun,
} from '../functions/_lib/content-search-run-repository';
import {
  onRequestGet as searchRunsGet,
  onRequestPost as searchRunsPost,
} from '../functions/api/admin/content-pipeline/search-runs/index';
import { onRequestPost as searchRunsCompletePost } from '../functions/api/admin/content-pipeline/search-runs/complete';

const ADMIN_TOKEN = 'test-admin-token';

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
          return {
            success: true,
            meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) },
          };
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
          return {
            success: true,
            meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) },
          };
        },
      };
    },
  };
}

function freshDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyRepoMigrations(sqlite);
  return wrapSqliteAsD1(sqlite);
}

async function locSourceId(db: ReturnType<typeof wrapSqliteAsD1>): Promise<number> {
  const row = await db.prepare('SELECT id FROM sources WHERE source_domain = ?').bind('loc.gov').first();
  return Number((row as { id: number }).id);
}

function adminGetRequest(path: string, token = ADMIN_TOKEN): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': token },
  });
}

function adminPostRequest(path: string, body: unknown, token = ADMIN_TOKEN): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

describe('search run request parsing (#3552)', () => {
  it('requires run_uid and source_domain to start a run', () => {
    const missingSource = parseStartSearchRunRequest({ run_uid: 'run-1' });
    expect(missingSource.ok).toBe(false);

    const missingRunUid = parseStartSearchRunRequest({ source_domain: 'loc.gov' });
    expect(missingRunUid.ok).toBe(false);

    const valid = parseStartSearchRunRequest({ run_uid: 'run-1', source_domain: 'loc.gov', query: 'Lou Gehrig' });
    expect(valid.ok).toBe(true);
  });

  it('rejects an unknown terminal status', () => {
    const result = parseCompleteSearchRunRequest({ run_uid: 'run-1', status: 'still_going' });
    expect(result.ok).toBe(false);
  });

  it('rejects running as a completion status (running is not terminal)', () => {
    const result = parseCompleteSearchRunRequest({ run_uid: 'run-1', status: 'running' });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid terminal completion with counts', () => {
    const result = parseCompleteSearchRunRequest({
      run_uid: 'run-1',
      status: 'completed',
      discovered_count: 5,
      new_count: 5,
    });
    expect(result.ok).toBe(true);
  });
});

describe('search run repository (#3552)', () => {
  it('starts a run against exactly one source and completes it with a terminal state', async () => {
    const db = freshDb();
    const sourceId = await locSourceId(db);

    const started = await startSearchRun(db, {
      run_uid: 'run-loc-1',
      source_id: sourceId,
      query: 'Lou Gehrig',
    });
    expect(started.status).toBe('running');
    expect(started.source_id).toBe(sourceId);

    const completed = await completeSearchRun(db, 'run-loc-1', {
      status: 'completed',
      discovered_count: 3,
      new_count: 3,
    });
    expect(completed?.status).toBe('completed');
    expect(completed?.discovered_count).toBe(3);
    expect(completed?.completed_at).not.toBeNull();
  });

  it('does not let a second complete call overwrite an already-terminal run', async () => {
    const db = freshDb();
    const sourceId = await locSourceId(db);
    await startSearchRun(db, { run_uid: 'run-loc-2', source_id: sourceId });
    await completeSearchRun(db, 'run-loc-2', { status: 'completed', discovered_count: 1 });

    // A second completion attempt should be a no-op at the repository layer
    // (WHERE status = 'running' guards it) -- the admin endpoint enforces
    // this explicitly with a 409, exercised below.
    const secondAttempt = await completeSearchRun(db, 'run-loc-2', { status: 'source_error', error_count: 1 });
    expect(secondAttempt?.status).toBe('completed');
    expect(secondAttempt?.error_count).toBe(0);
  });

  it('expires a stale running run into source_error once its lease passes', async () => {
    const db = freshDb();
    const sourceId = await locSourceId(db);
    await startSearchRun(db, { run_uid: 'run-loc-stale', source_id: sourceId, lease_seconds: -1 });

    const expiredCount = await expireStaleRunningSearchRuns(db);
    expect(expiredCount).toBe(1);

    const run = await getSearchRunByUid(db, 'run-loc-stale');
    expect(run?.status).toBe('source_error');
    expect(run?.error_summary).toContain('lease expired');
  });

  it('heartbeat extends the lease and keeps the run running', async () => {
    const db = freshDb();
    const sourceId = await locSourceId(db);
    await startSearchRun(db, { run_uid: 'run-loc-hb', source_id: sourceId, lease_seconds: 5 });

    const heartbeat = await heartbeatSearchRun(db, 'run-loc-hb', 900);
    expect(heartbeat?.status).toBe('running');

    const expiredCount = await expireStaleRunningSearchRuns(db);
    expect(expiredCount).toBe(0);
  });

  it('lists runs filtered by status', async () => {
    const db = freshDb();
    const sourceId = await locSourceId(db);
    await startSearchRun(db, { run_uid: 'run-a', source_id: sourceId });
    await startSearchRun(db, { run_uid: 'run-b', source_id: sourceId });
    await completeSearchRun(db, 'run-b', { status: 'no_results' });

    const running = await listSearchRuns(db, { status: 'running' });
    expect(running.map((r) => r.run_uid)).toEqual(['run-a']);

    const finished = await listSearchRuns(db, { status: 'no_results' });
    expect(finished.map((r) => r.run_uid)).toEqual(['run-b']);
  });
});

describe('search run admin API (#3552)', () => {
  it('returns 401 without admin authorization', async () => {
    const response = await searchRunsGet({
      env: { DB: {}, ADMIN_TOKEN },
      request: adminGetRequest('/api/admin/content-pipeline/search-runs', 'wrong-token'),
    });
    expect(response.status).toBe(401);
  });

  it('rejects starting a run against an unapproved source_domain', async () => {
    const db = freshDb();
    const response = await searchRunsPost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', {
        run_uid: 'run-bad-source',
        source_domain: 'random-flea-market.example',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('starts and completes a run end-to-end through the HTTP handlers', async () => {
    const db = freshDb();

    const startResponse = await searchRunsPost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', {
        run_uid: 'run-e2e-1',
        source_domain: 'loc.gov',
        query: 'Lou Gehrig',
        result_limit: 20,
      }),
    });
    expect(startResponse.status).toBe(201);
    const startBody = await startResponse.json();
    expect(startBody.run.status).toBe('running');

    const completeResponse = await searchRunsCompletePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs/complete', {
        run_uid: 'run-e2e-1',
        status: 'completed',
        discovered_count: 7,
        new_count: 7,
      }),
    });
    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json();
    expect(completeBody.run.status).toBe('completed');
    expect(completeBody.run.discovered_count).toBe(7);

    // Completing an already-terminal run is rejected, not silently accepted.
    const secondComplete = await searchRunsCompletePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs/complete', {
        run_uid: 'run-e2e-1',
        status: 'no_results',
      }),
    });
    expect(secondComplete.status).toBe(409);

    const listResponse = await searchRunsGet({
      env: { DB: db, ADMIN_TOKEN },
      request: adminGetRequest('/api/admin/content-pipeline/search-runs?status=completed'),
    });
    const listBody = await listResponse.json();
    expect(listBody.count).toBe(1);
    expect(listBody.runs[0].run_uid).toBe('run-e2e-1');
  });

  it('completing an unknown run_uid returns 404', async () => {
    const db = freshDb();
    const response = await searchRunsCompletePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs/complete', {
        run_uid: 'does-not-exist',
        status: 'completed',
      }),
    });
    expect(response.status).toBe(404);
  });

  it('duplicate run_uid on start is rejected with 409', async () => {
    const db = freshDb();
    const body = { run_uid: 'run-dup', source_domain: 'loc.gov' };

    const first = await searchRunsPost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', body),
    });
    expect(first.status).toBe(201);

    const second = await searchRunsPost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', body),
    });
    expect(second.status).toBe(409);
  });
});
