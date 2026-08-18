// @vitest-environment node
//
// jsdom's Request/FormData/File implementation does not correctly parse a
// multipart body via .formData() -- it hangs indefinitely rather than
// resolving or throwing. This suite exercises real file-upload parsing, so
// it needs Node's native fetch/FormData/File instead of jsdom's.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost as uploadPost } from '../../functions/api/fanclub/photos/upload';

const B2_ENV = {
  B2_ENDPOINT: 'https://s3.example-b2.com',
  B2_BUCKET: 'lgfc-media',
  B2_KEY_ID: 'test-key-id',
  B2_APP_KEY: 'test-app-key',
};

// A minimal valid JPEG signature (SOI + APP0 marker start) padded out --
// validateIngestMagicBytes only checks the leading magic bytes.
const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

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
  return { sqlite, db: wrapSqliteAsD1(sqlite) };
}

function seedMemberSession(sqlite: DatabaseSync, sessionId = 'session-3552', email = 'member@example.com') {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function uploadRequest(
  fields: Record<string, string>,
  file: { bytes: Uint8Array; name: string; type: string } | null,
  sessionId = 'session-3552',
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  if (file) {
    form.set('file', new File([file.bytes], file.name, { type: file.type }));
  }
  return new Request('https://www.lougehrigfanclub.com/api/fanclub/photos/upload', {
    method: 'POST',
    headers: { Cookie: `lgfc_session=${sessionId}` },
    body: form,
  });
}

function grantFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    submitter_name: 'Jane Member',
    credit_preference: 'public_credit',
    rights_choice: 'member_owns_full_grant',
    ...overrides,
  };
}

function evaluationFields(overrides: Record<string, string> = {}): Record<string, string> {
  return grantFields({
    rights_choice: 'external_source_needs_evaluation',
    source_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    ...overrides,
  });
}

function mockB2Put() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith(B2_ENV.B2_ENDPOINT)) {
      return new Response(null, { status: 200, headers: { ETag: '"fake-etag"' } });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe('POST /api/fanclub/photos/upload (#3552/#3553 Path C -- two-choice rights UX)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unauthenticated request before touching the file or B2', async () => {
    const { db } = freshDb();
    const fetchSpy = mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(grantFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }, 'no-such-session'),
    });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed (400) when rights_choice is missing or invalid, even with everything else valid', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const missing = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(
        grantFields({ rights_choice: '' }),
        { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
      ),
    });
    expect(missing.status).toBe(400);

    const invalid = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(
        grantFields({ rights_choice: 'something_else' }),
        { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
      ),
    });
    expect(invalid.status).toBe(400);

    expect(fetchSpy).not.toHaveBeenCalled();
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('fails closed (400) when rights_choice is external_source_needs_evaluation but source_url is missing', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(
        grantFields({ rights_choice: 'external_source_needs_evaluation' }),
        { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
      ),
    });

    expect(response.status).toBe(400);
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it.each(['submitter_name', 'credit_preference'])('fails closed (400) when %s is missing', async (field) => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(
        grantFields({ [field]: '' }),
        { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
      ),
    });

    expect(response.status).toBe(400);
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('rejects a file whose bytes do not match its declared content type', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(grantFields(), {
        bytes: new TextEncoder().encode('<html>not an image</html>'),
        name: 'photo.jpg',
        type: 'image/jpeg',
      }),
    });

    expect(response.status).toBe(422);
  });

  it('member_owns_full_grant: clears rights immediately -- media_assets.rights_hold=0, consent granted', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(grantFields({ people_tags: 'Lou Gehrig, Babe Ruth' }), {
        bytes: FAKE_JPEG_BYTES,
        name: 'photo.jpg',
        type: 'image/jpeg',
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      b2_key: string;
      media_uid: string;
      already_existed: boolean;
      rights_hold: number;
    };
    expect(body.ok).toBe(true);
    expect(body.b2_key.startsWith('LGFC_MEMBER_')).toBe(true);
    expect(body.already_existed).toBe(false);
    expect(body.rights_hold).toBe(0);

    const b2PutCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.startsWith(B2_ENV.B2_ENDPOINT);
    });
    expect(b2PutCalls).toHaveLength(1);

    const mediaRow = sqlite
      .prepare('SELECT rights_hold, rights_hold_reason FROM media_assets WHERE media_uid = ?')
      .get(body.media_uid) as { rights_hold: number; rights_hold_reason: string };
    expect(mediaRow.rights_hold).toBe(0);
    expect(mediaRow.rights_hold_reason).toContain('reviewer:Jane Member');

    const contentItemRow = sqlite
      .prepare(
        'SELECT input_stream, content_type, rights_status, review_status, media_asset_id FROM content_items WHERE candidate_id = ?',
      )
      .get(`member-photo-${body.media_uid}`) as {
      input_stream: string;
      content_type: string;
      rights_status: string;
      review_status: string;
      media_asset_id: string;
    };
    expect(contentItemRow.input_stream).toBe('member_submission');
    expect(contentItemRow.content_type).toBe('photo');
    expect(contentItemRow.rights_status).toBe('permission_granted');
    expect(contentItemRow.review_status).toBe('approved_public_candidate');
    expect(contentItemRow.media_asset_id).toBe(`b2://${body.b2_key}`);

    const submissionRow = sqlite
      .prepare(
        `SELECT ms.consent_status, ms.admin_followup_required, ms.credit_preference
         FROM member_submissions ms JOIN content_items ci ON ci.id = ms.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as {
      consent_status: string;
      admin_followup_required: number;
      credit_preference: string;
    };
    expect(submissionRow.consent_status).toBe('granted');
    expect(submissionRow.admin_followup_required).toBe(0);
    expect(submissionRow.credit_preference).toBe('public_credit');

    const evidence = sqlite
      .prepare(
        `SELECT re.evidence_type, re.conclusion, re.reviewer
         FROM rights_evidence re JOIN content_items ci ON ci.id = re.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as { evidence_type: string; conclusion: string; reviewer: string };
    expect(evidence.evidence_type).toBe('member_ownership');
    expect(evidence.conclusion).toBe('lgfc_member_owned_item_photo');
    expect(evidence.reviewer).toBe('Jane Member');

    const tagCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS n FROM content_item_tags cit JOIN content_items ci ON ci.id = cit.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as { n: number };
    expect(tagCount.n).toBe(2);
  });

  it('external_source_needs_evaluation: photo stays held and is queued for copyright evaluation', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(evaluationFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; media_uid: string; rights_hold: number };
    expect(body.ok).toBe(true);
    expect(body.rights_hold).toBe(1);

    const mediaRow = sqlite
      .prepare('SELECT rights_hold FROM media_assets WHERE media_uid = ?')
      .get(body.media_uid) as { rights_hold: number };
    expect(mediaRow.rights_hold).toBe(1);

    const submissionRow = sqlite
      .prepare(
        `SELECT ms.consent_status, ms.admin_followup_required
         FROM member_submissions ms JOIN content_items ci ON ci.id = ms.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as { consent_status: string; admin_followup_required: number };
    expect(submissionRow.consent_status).toBe('pending');
    expect(submissionRow.admin_followup_required).toBe(1);

    const evidence = sqlite
      .prepare(
        `SELECT re.evidence_type, re.conclusion, re.evidence_url
         FROM rights_evidence re JOIN content_items ci ON ci.id = re.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as { evidence_type: string; conclusion: string | null; evidence_url: string };
    expect(evidence.evidence_type).toBe('other');
    expect(evidence.conclusion).toBeNull();
    expect(evidence.evidence_url).toBe('https://commons.wikimedia.org/wiki/File:Example.jpg');
  });

  it('a second identical upload is idempotent: no second B2 write, same media_uid', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const first = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(grantFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
    });
    const firstBody = (await first.json()) as { media_uid: string };

    const second = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(grantFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { media_uid: string; already_existed: boolean };

    expect(secondBody.media_uid).toBe(firstBody.media_uid);
    expect(secondBody.already_existed).toBe(true);

    const b2PutCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.startsWith(B2_ENV.B2_ENDPOINT);
    });
    expect(b2PutCalls).toHaveLength(1);

    const mediaCount = sqlite
      .prepare('SELECT COUNT(*) AS n FROM media_assets WHERE media_uid = ?')
      .get(firstBody.media_uid) as { n: number };
    expect(mediaCount.n).toBe(1);
  });
});
