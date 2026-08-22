import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { onRequestPost as ingestPost } from '../functions/api/admin/content-pipeline/ingest';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

const B2_ENV = {
  B2_ENDPOINT: 'https://s3.example-b2.com',
  B2_BUCKET: 'lgfc-media',
  B2_KEY_ID: 'test-key-id',
  B2_APP_KEY: 'test-app-key',
};

// A minimal valid JPEG signature (SOI + APP0 marker start) padded out --
// the ingestion path only checks the leading magic bytes, not full decode.
const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

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

function adminPostRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// aws4fetch's AwsClient.fetch signs the request and calls global fetch with
// a single Request object (not a separate url/init pair), so URL and method
// must be read off that Request instance, not the raw call arguments.
function requestUrlAndMethod(input: unknown, init: unknown): { url: string; method: string } {
  if (input instanceof Request) {
    return { url: input.url, method: input.method };
  }
  return { url: String(input), method: (init as { method?: string } | undefined)?.method ?? 'GET' };
}

// Response.url is normally populated by the fetch implementation from the
// final (post-redirect) URL and isn't settable via the constructor -- tests
// that care about it (the redirect-allowlist check) need to force it.
function responseWithUrl(response: Response, url: string): Response {
  Object.defineProperty(response, 'url', { value: url, configurable: true });
  return response;
}

function mockFetchForSourceAndB2(options?: {
  sourceBytes?: Uint8Array;
  sourceContentType?: string;
  finalSourceUrl?: string;
}) {
  const sourceBytes = options?.sourceBytes ?? FAKE_JPEG_BYTES;
  const sourceContentType = options?.sourceContentType ?? 'image/jpeg';

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { url } = requestUrlAndMethod(input, init);
    if (url.startsWith(B2_ENV.B2_ENDPOINT)) {
      return new Response(null, { status: 200, headers: { ETag: '"fake-etag"' } });
    }
    // Source fetch (LOC/Commons/Openverse). Defaults to reporting the
    // requested URL as final (no redirect) unless a test says otherwise.
    const sourceResponse = new Response(sourceBytes, { status: 200, headers: { 'Content-Type': sourceContentType } });
    return responseWithUrl(sourceResponse, options?.finalSourceUrl ?? url);
  });
}

describe('content pipeline ingestion (#3552)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without admin authorization', async () => {
    const response = await ingestPost({
      env: { DB: {}, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }, null),
    });
    expect(response.status).toBe(401);
  });

  it('refuses to ingest a candidate with no recorded rights_evidence conclusion', async () => {
    const db = freshDb();
    await upsertCandidate(db, minimalCandidate());
    mockFetchForSourceAndB2();

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });
    expect(response.status).toBe(409);
  });

  it('rejects a source_fetch_url on a domain outside the allowlist', async () => {
    const db = freshDb();
    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'pre_1931_publication',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'Confirmed 1928 publication.',
    });
    const fetchSpy = mockFetchForSourceAndB2();

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://random-image-host.example/x.jpg',
      }),
    });
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a fetched file whose bytes do not match its declared content type', async () => {
    const db = freshDb();
    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
    });
    mockFetchForSourceAndB2({
      sourceBytes: new TextEncoder().encode('<html>not an image</html>'),
      sourceContentType: 'image/jpeg',
    });

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });
    expect(response.status).toBe(422);
  });

  it('rejects an unsupported content type', async () => {
    const db = freshDb();
    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
    });
    mockFetchForSourceAndB2({ sourceContentType: 'application/pdf' });

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });
    expect(response.status).toBe(422);
  });

  it('ingests a valid, rights-cleared candidate end-to-end: B2 write + idempotent D1 commit with rights_hold=0', async () => {
    const db = freshDb();
    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
    });
    const fetchSpy = mockFetchForSourceAndB2();

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.b2_key.startsWith('LGFC_')).toBe(true);
    expect(body.already_ingested).toBe(false);
    expect(body.conclusion).toBe('public_domain_confirmed');

    const b2PutCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const { url, method } = requestUrlAndMethod(input, init);
      return url.startsWith(B2_ENV.B2_ENDPOINT) && method === 'PUT';
    });
    expect(b2PutCalls).toHaveLength(1);

    const mediaRow = (await db
      .prepare('SELECT rights_hold, b2_key FROM media_assets WHERE media_uid = ?')
      .bind(body.media_uid)
      .first()) as { rights_hold: number; b2_key: string };
    expect(mediaRow.rights_hold).toBe(0);
    expect(mediaRow.b2_key).toBe(body.b2_key);

    const contentItemRow = (await db
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .bind('lgfc-gehrig-2026-999')
      .first()) as { media_asset_id: string };
    expect(contentItemRow.media_asset_id).toBe(`b2://${body.b2_key}`);

    // Second ingest of the identical bytes must not re-write to B2.
    const secondResponse = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });
    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.already_ingested).toBe(true);

    const b2PutCallsAfterSecond = fetchSpy.mock.calls.filter(([input, init]) => {
      const { url, method } = requestUrlAndMethod(input, init);
      return url.startsWith(B2_ENV.B2_ENDPOINT) && method === 'PUT';
    });
    expect(b2PutCallsAfterSecond).toHaveLength(1); // still just the one PUT from the first call
  });

  it('two different candidates ingesting identical bytes land on the same B2 key (checksum-derived, not candidate-scoped)', async () => {
    const db = freshDb();
    const candidateA = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-001' }));
    const candidateB = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-002' }));
    for (const candidate of [candidateA, candidateB]) {
      await recordRightsEvidence(db, {
        content_item_id: candidate.id,
        evidence_type: 'loc_statement',
        reviewer: 'Bill',
        conclusion: 'public_domain_confirmed',
        conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
      });
    }
    const fetchSpy = mockFetchForSourceAndB2();

    const firstResponse = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-001',
        source_fetch_url: 'https://loc.gov/item/one.jpg',
      }),
    });
    const firstBody = await firstResponse.json();
    expect(firstBody.already_ingested).toBe(false);

    // Different candidate, same underlying bytes (identical FAKE_JPEG_BYTES).
    const secondResponse = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-002',
        source_fetch_url: 'https://loc.gov/item/two.jpg',
      }),
    });
    const secondBody = await secondResponse.json();

    expect(secondBody.b2_key).toBe(firstBody.b2_key);
    expect(secondBody.already_ingested).toBe(true);

    const b2PutCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const { url, method } = requestUrlAndMethod(input, init);
      return url.startsWith(B2_ENV.B2_ENDPOINT) && method === 'PUT';
    });
    expect(b2PutCalls).toHaveLength(1); // only the first candidate's ingest actually wrote to B2

    // The second candidate must still be linked to the real, actually-written key.
    const contentItemRow = (await db
      .prepare('SELECT media_asset_id FROM content_items WHERE candidate_id = ?')
      .bind('lgfc-gehrig-2026-002')
      .first()) as { media_asset_id: string };
    expect(contentItemRow.media_asset_id).toBe(`b2://${firstBody.b2_key}`);
  });

  it('rejects a source that redirects off the allowlist, even though the requested URL was allowlisted', async () => {
    const db = freshDb();
    const candidate = await upsertCandidate(db, minimalCandidate());
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC no known restrictions + pre-1931 publication.',
    });
    const fetchSpy = mockFetchForSourceAndB2({ finalSourceUrl: 'https://attacker-controlled.example/payload.jpg' });

    const response = await ingestPost({
      env: { DB: db, ...B2_ENV },
      request: adminPostRequest('/api/admin/content-pipeline/ingest', {
        candidate_id: 'lgfc-gehrig-2026-999',
        source_fetch_url: 'https://loc.gov/item/example.jpg',
      }),
    });

    expect(response.status).toBe(400);
    const b2PutCalls = fetchSpy.mock.calls.filter(([input, init]) => {
      const { url, method } = requestUrlAndMethod(input, init);
      return url.startsWith(B2_ENV.B2_ENDPOINT) && method === 'PUT';
    });
    expect(b2PutCalls).toHaveLength(0);
  });
});
