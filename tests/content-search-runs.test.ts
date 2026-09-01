import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { onRequestPost as ingestPost } from '../functions/api/admin/content-pipeline/ingest';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

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
  seedAdminSession(sqlite);
  return wrapSqliteAsD1(sqlite);
}

// Wraps the same sqlite-backed D1 shim as wrapSqliteAsD1, but makes any
// prepared statement whose SQL text is matched by `shouldFail` throw on
// `.run()` instead of executing -- used to simulate a D1 write failing
// partway through an otherwise-successful operation (AC #13's "failed D1
// commit" / "rollback" scenarios).
function wrapSqliteAsD1WithFailure(sqlite: DatabaseSync, shouldFail: (sql: string) => boolean) {
  const base = wrapSqliteAsD1(sqlite);
  return {
    ...base,
    prepare(sql: string) {
      if (!shouldFail(sql)) {
        return base.prepare(sql);
      }
      const throwingRun = async () => {
        throw new Error(`Simulated D1 write failure for: ${sql}`);
      };
      return {
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: throwingRun,
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
        run: throwingRun,
      };
    },
  };
}

async function locSourceId(db: ReturnType<typeof wrapSqliteAsD1>): Promise<number> {
  const row = await db.prepare('SELECT id FROM sources WHERE source_domain = ?').bind('loc.gov').first();
  return Number((row as { id: number }).id);
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
      env: { DB: {} },
      request: adminGetRequest('/api/admin/content-pipeline/search-runs', null),
    });
    expect(response.status).toBe(401);
  });

  it('rejects starting a run against an unapproved source_domain', async () => {
    const db = freshDb();
    const response = await searchRunsPost({
      env: { DB: db },
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
      env: { DB: db },
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
      env: { DB: db },
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
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs/complete', {
        run_uid: 'run-e2e-1',
        status: 'no_results',
      }),
    });
    expect(secondComplete.status).toBe(409);

    const listResponse = await searchRunsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/search-runs?status=completed'),
    });
    const listBody = await listResponse.json();
    expect(listBody.count).toBe(1);
    expect(listBody.runs[0].run_uid).toBe('run-e2e-1');
  });

  it('completing an unknown run_uid returns 404', async () => {
    const db = freshDb();
    const response = await searchRunsCompletePost({
      env: { DB: db },
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
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', body),
    });
    expect(first.status).toBe(201);

    const second = await searchRunsPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/search-runs', body),
    });
    expect(second.status).toBe(409);
  });
});

// AC #13's audit-flagged scenarios: failed B2 write, failed D1 commit, and
// rollback -- none of these are properties of content_search_runs itself
// (the B2/media-commit code path lives entirely in
// functions/api/admin/content-pipeline/ingest.ts and
// functions/_lib/media-ingest-repository.ts, neither of which is in #3657's
// allowlisted files). These tests exercise that existing, already-shipped
// code purely by import -- no source file outside the allowlist is edited --
// to characterize its actual current failure behavior, per the design
// package's explicit instruction to add these scenarios here.
describe('B2 write / D1 commit / rollback failure scenarios (#3552 audit AC #13, exercised via #3657)', () => {
  const B2_ENV = {
    B2_ENDPOINT: 'https://s3.example-b2.com',
    B2_BUCKET: 'lgfc-media',
    B2_KEY_ID: 'test-key-id',
    B2_APP_KEY: 'test-app-key',
  };

  const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

  function minimalIngestCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
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

  function requestUrlAndMethod(input: unknown, init: unknown): { url: string; method: string } {
    if (input instanceof Request) {
      return { url: input.url, method: input.method };
    }
    return { url: String(input), method: (init as { method?: string } | undefined)?.method ?? 'GET' };
  }

  // Response.url is normally populated by the fetch implementation from the
  // final (post-redirect) URL and isn't settable via the constructor --
  // ingest.ts's redirect-allowlist check reads it, so mocks must force it.
  function responseWithUrl(response: Response, url: string): Response {
    Object.defineProperty(response, 'url', { value: url, configurable: true });
    return response;
  }

  function adminIngestPostRequest(body: unknown): Request {
    return new Request('https://www.lougehrigfanclub.com/api/admin/content-pipeline/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ADMIN_SESSION_COOKIE },
      body: JSON.stringify(body),
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('failed B2 write: no D1 row is committed and the source fetch is not left in an inconsistent state', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalIngestCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
      channel: 'website',
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestUrlAndMethod(input, init);
      if (url.startsWith(B2_ENV.B2_ENDPOINT)) {
        // The B2 PUT itself fails (simulates a network/service error).
        throw new Error('simulated B2 PutObject network failure');
      }
      const sourceResponse = new Response(FAKE_JPEG_BYTES, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      return responseWithUrl(sourceResponse, url);
    });

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminIngestPostRequest({
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });

    // The failure surfaces as an error response, not a silent success.
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.json();
    expect(body.ok).toBe(false);

    // No media_assets row and no content_items link were ever committed --
    // the D1 commit step (commitIngestedMedia) never runs because the B2
    // write throws before it's reached.
    const mediaCount = sqlite.prepare('SELECT COUNT(*) AS count FROM media_assets').get() as { count: number };
    expect(mediaCount.count).toBe(0);

    const contentItemRow = sqlite
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-999') as { media_asset_id: string | null };
    expect(contentItemRow.media_asset_id).toBeNull();
  });

  it('failed D1 commit after a successful B2 write: the request does not silently succeed, the B2-written object and its media_assets row are left without a content_items link, but the response now carries structured recovery detail (#3837)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);

    // Only the content_items UPDATE issued by updateCandidateMediaReferences
    // (inside commitIngestedMedia's second step) fails -- the media_assets
    // INSERT that happens first is a separate, already-committed statement.
    const db = wrapSqliteAsD1WithFailure(sqlite, (sql) => sql.includes('UPDATE content_items'));

    const candidate = await upsertCandidate(db, minimalIngestCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
      channel: 'website',
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestUrlAndMethod(input, init);
      if (url.startsWith(B2_ENV.B2_ENDPOINT)) {
        return new Response(null, { status: 200, headers: { ETag: '"fake-etag"' } });
      }
      const sourceResponse = new Response(FAKE_JPEG_BYTES, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      return responseWithUrl(sourceResponse, url);
    });

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminIngestPostRequest({
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });

    // The failure is reported, not swallowed -- a caller cannot mistake this
    // for a successful ingest.
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.json();
    expect(body.ok).toBe(false);

    // #3837: the media_assets row is durable, true metadata about a real B2
    // write and is deliberately NOT rolled back just because the
    // content_items link step failed -- but the response must now say so
    // explicitly, with enough detail that a caller/operator can act without
    // reading source code, rather than a bare "Ingestion failed."
    expect(body.recoverable).toBe(true);
    expect(body.media_uid).toEqual(expect.any(String));
    expect(body.b2_key).toEqual(expect.any(String));
    expect(body.candidate_id).toBe('lgfc-gehrig-2026-999');
    expect(body.retry_hint).toMatch(/re-post/i);

    const mediaCount = sqlite.prepare('SELECT COUNT(*) AS count FROM media_assets').get() as { count: number };
    expect(mediaCount.count).toBe(1); // the B2-written object's media_assets row was NOT rolled back

    const contentItemRow = sqlite
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-999') as { media_asset_id: string | null };
    expect(contentItemRow.media_asset_id).toBeNull(); // the link itself was rolled back by the batch's own ROLLBACK
  });

  it('recovers from a failed D1 commit: retrying the exact same ingest request after the transient failure clears completes the content_items link without a re-upload (#3837)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);

    const failingDb = wrapSqliteAsD1WithFailure(sqlite, (sql) => sql.includes('UPDATE content_items'));

    const candidate = await upsertCandidate(failingDb, minimalIngestCandidate());
    await recordRightsEvidence(failingDb, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
      channel: 'website',
    });

    let b2PutCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url } = requestUrlAndMethod(input, init);
      if (url.startsWith(B2_ENV.B2_ENDPOINT)) {
        b2PutCount += 1;
        return new Response(null, { status: 200, headers: { ETag: '"fake-etag"' } });
      }
      const sourceResponse = new Response(FAKE_JPEG_BYTES, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      return responseWithUrl(sourceResponse, url);
    });

    const ingestBody = {
      candidate_id: 'lgfc-gehrig-2026-999',
      source_fetch_url: 'https://loc.gov/item/example.jpg',
    };

    const firstAttempt = await ingestPost({
      env: { DB: failingDb, ...B2_ENV },
      request: adminIngestPostRequest(ingestBody),
    });
    expect(firstAttempt.status).toBeGreaterThanOrEqual(500);
    expect((await firstAttempt.json()).recoverable).toBe(true);
    expect(b2PutCount).toBe(1);

    // Same underlying sqlite state, but this time the content_items UPDATE
    // is allowed to run -- simulates the transient failure clearing before
    // the caller's retry.
    const healthyDb = wrapSqliteAsD1(sqlite);
    const retry = await ingestPost({
      env: { DB: healthyDb, ...B2_ENV },
      request: adminIngestPostRequest(ingestBody),
    });

    expect(retry.status).toBe(200);
    const retryBody = await retry.json();
    expect(retryBody.ok).toBe(true);
    expect(retryBody.already_ingested).toBe(true); // media_uid dedup hit -- no re-upload

    // The retry did not re-PUT the object to B2.
    expect(b2PutCount).toBe(1);

    const mediaCount = sqlite.prepare('SELECT COUNT(*) AS count FROM media_assets').get() as { count: number };
    expect(mediaCount.count).toBe(1); // still exactly one row, not duplicated

    const contentItemRow = sqlite
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-999') as { media_asset_id: string | null };
    expect(contentItemRow.media_asset_id).toBe(`b2://${retryBody.b2_key}`); // the orphan is now linked
  });

  it('rollback: a search run that errors mid-completion is left running (not silently marked complete), so a later read cannot mistake it for success', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const plainDb = wrapSqliteAsD1(sqlite);
    const sourceRow = await plainDb.prepare('SELECT id FROM sources WHERE source_domain = ?').bind('loc.gov').first();
    const sourceId = Number((sourceRow as { id: number }).id);

    await startSearchRun(plainDb, { run_uid: 'run-rollback-1', source_id: sourceId });

    const failingDb = wrapSqliteAsD1WithFailure(sqlite, (sql) => sql.includes('UPDATE content_search_runs') && sql.includes('SET status'));

    await expect(
      completeSearchRun(failingDb, 'run-rollback-1', { status: 'completed', discovered_count: 5 }),
    ).rejects.toThrow(/Simulated D1 write failure/);

    // The run must still read as 'running' -- not completed, and not stuck
    // in some third, ambiguous state a later reader could mistake for
    // success. The single-statement UPDATE either fully applies or (as
    // here) doesn't run at all, so there is no partial-write state to worry
    // about for this table.
    const run = await getSearchRunByUid(plainDb, 'run-rollback-1');
    expect(run?.status).toBe('running');
    expect(run?.completed_at).toBeNull();

    // A legitimate completion attempt afterward still succeeds -- the
    // failed attempt didn't corrupt the row or leave it un-completable.
    const recovered = await completeSearchRun(plainDb, 'run-rollback-1', { status: 'completed', discovered_count: 5 });
    expect(recovered?.status).toBe('completed');
  });

  it('rollback: a rights_evidence INSERT failure records nothing -- no half-written evidence row that a later read could mistake for a real conclusion', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalIngestCandidate({ candidate_id: 'lgfc-gehrig-2026-998' }));

    const failingDb = wrapSqliteAsD1WithFailure(sqlite, (sql) => sql.includes('INSERT INTO rights_evidence'));

    await expect(
      recordRightsEvidence(failingDb, {
        content_item_id: candidate.id,
        evidence_type: 'loc_statement',
        reviewer: 'Bill',
        conclusion: 'public_domain_confirmed',
        conclusion_rationale: 'LOC no known restrictions.',
        channel: 'website',
      }),
    ).rejects.toThrow(/Simulated D1 write failure/);

    const count = sqlite
      .prepare('SELECT COUNT(*) AS count FROM rights_evidence WHERE content_item_id = ?')
      .get(candidate.id) as { count: number };
    expect(count.count).toBe(0);
  });
});
