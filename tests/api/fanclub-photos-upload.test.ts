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

function validFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    submitter_name: 'Jane Member',
    ownership_statement: 'I took this photo myself at the 2025 club picnic.',
    permission_statement: 'LGFC may use this on the website.',
    credit_preference: 'public_credit',
    attest_owns_rights: 'true',
    ...overrides,
  };
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

describe('POST /api/fanclub/photos/upload (#3552/#3553 Path C)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unauthenticated request before touching the file or B2', async () => {
    const { db } = freshDb();
    const fetchSpy = mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(validFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }, 'no-such-session'),
    });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed (400) when the rights-attestation checkbox is missing, even with everything else valid', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(
        validFields({ attest_owns_rights: '' }),
        { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
      ),
    });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();

    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it.each(['submitter_name', 'ownership_statement', 'permission_statement', 'credit_preference'])(
    'fails closed (400) when %s is missing',
    async (field) => {
      const { sqlite, db } = freshDb();
      seedMemberSession(sqlite);

      const response = await uploadPost({
        env: { DB: db, ...B2_ENV },
        request: uploadRequest(
          validFields({ [field]: '' }),
          { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' },
        ),
      });

      expect(response.status).toBe(400);
      const count = sqlite.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number };
      expect(count.n).toBe(0);
    },
  );

  it('rejects a file whose bytes do not match its declared content type', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(validFields(), {
        bytes: new TextEncoder().encode('<html>not an image</html>'),
        name: 'photo.jpg',
        type: 'image/jpeg',
      }),
    });

    expect(response.status).toBe(422);
  });

  it('submits a valid, attested photo: B2 write + pending member_submissions row + media_assets still held', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const response = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(validFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; b2_key: string; media_uid: string; already_existed: boolean };
    expect(body.ok).toBe(true);
    expect(body.b2_key.startsWith('LGFC_MEMBER_')).toBe(true);
    expect(body.already_existed).toBe(false);

    const b2PutCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.startsWith(B2_ENV.B2_ENDPOINT);
    });
    expect(b2PutCalls).toHaveLength(1);

    const mediaRow = sqlite
      .prepare('SELECT rights_hold FROM media_assets WHERE media_uid = ?')
      .get(body.media_uid) as { rights_hold: number };
    // Member self-attestation is recorded as evidence, but never self-grants
    // publish approval -- the row stays at the column default (held) until
    // an admin separately reviews it.
    expect(mediaRow.rights_hold).toBe(1);

    const contentItemRow = sqlite
      .prepare("SELECT input_stream, content_type, media_asset_id FROM content_items WHERE candidate_id = ?")
      .get(`member-photo-${body.media_uid}`) as { input_stream: string; content_type: string; media_asset_id: string };
    expect(contentItemRow.input_stream).toBe('member_submission');
    expect(contentItemRow.content_type).toBe('photo');
    expect(contentItemRow.media_asset_id).toBe(`b2://${body.b2_key}`);

    const submissionRow = sqlite
      .prepare(
        `SELECT ms.consent_status, ms.ownership_statement, ms.permission_statement, ms.credit_preference
         FROM member_submissions ms JOIN content_items ci ON ci.id = ms.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(`member-photo-${body.media_uid}`) as {
      consent_status: string;
      ownership_statement: string;
      permission_statement: string;
      credit_preference: string;
    };
    expect(submissionRow.consent_status).toBe('pending');
    expect(submissionRow.ownership_statement).toBe('I took this photo myself at the 2025 club picnic.');
    expect(submissionRow.credit_preference).toBe('public_credit');
  });

  it('a second identical upload is idempotent: no second B2 write, same media_uid', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();

    const first = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(validFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
    });
    const firstBody = (await first.json()) as { media_uid: string };

    const second = await uploadPost({
      env: { DB: db, ...B2_ENV },
      request: uploadRequest(validFields(), { bytes: FAKE_JPEG_BYTES, name: 'photo.jpg', type: 'image/jpeg' }),
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
