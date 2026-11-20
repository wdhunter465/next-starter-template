// @vitest-environment node
//
// jsdom's Request/FormData/File does not correctly parse multipart via .formData().
// This suite needs Node's native fetch/FormData/File.

import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from '../functions/api/admin/photos/bulk-upload';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const B2_ENV = {
  B2_ENDPOINT: 'https://s3.example-b2.com',
  B2_BUCKET: 'lgfc-media',
  B2_KEY_ID: 'test-key-id',
  B2_APP_KEY: 'test-app-key',
};

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function buildPngChunk(type: string, data: number[]): number[] {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const crcInput = new Uint8Array([...typeBytes, ...data]);
  const crc = crc32(crcInput);
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc)];
}

/** Valid PNG that passes validatePhotoUpload (signature + IHDR + IDAT + IEND). */
function buildRealPng(width: number, height: number): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrData = [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0];
  const ihdr = buildPngChunk('IHDR', ihdrData);
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width * 4; x++) raw.push(0);
  }
  const idat = buildPngChunk('IDAT', Array.from(deflateSync(Buffer.from(raw))));
  const iend = buildPngChunk('IEND', []);
  return new Uint8Array([...signature, ...ihdr, ...idat, ...iend]);
}

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    } catch {
      // Some migrations are environment-specific; ignore apply noise in unit tests.
    }
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

function seedAdminSession(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('admin-test@example.com', 'admin', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('test-admin-session', 'admin-test@example.com', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function seedMemberSession(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('admin-test@example.com', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('test-admin-session', 'admin-test@example.com', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function formRequest(
  fields: Record<string, string>,
  file: { bytes: Uint8Array; name: string; type: string } | null,
  cookie?: string,
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set('file', new File([file.bytes], file.name, { type: file.type }));
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/photos/bulk-upload', {
    method: 'POST',
    headers,
    body: form,
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

const ORDINARY_PNG = buildRealPng(64, 48);

describe('POST /api/admin/photos/bulk-upload (#4709)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses anonymous callers before B2', async () => {
    const { db } = freshDb();
    const fetchSpy = mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b1', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'a.png', type: 'image/png' },
      ),
      env: { DB: db, ...B2_ENV },
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a signed-in non-admin before B2', async () => {
    const { sqlite, db } = freshDb();
    seedMemberSession(sqlite);
    const fetchSpy = mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b1', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'a.png', type: 'image/png' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db, 'member'), ...B2_ENV },
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses HEIC with a clear message', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    const fetchSpy = mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b1', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'IMG_0001.HEIC', type: 'image/heic' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('heic_refused');
    expect(String(body.error)).toMatch(/HEIC|HEIF/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores lgfc_collection unpublished with LGFC credit and batch tag', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'batch-42', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'game_action_001.png', type: 'image/png' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('stored_unpublished');
    expect(body.rights_hold).toBe(true);
    expect(body.publication_eligible).toBe(false);
    expect(body.credit_line).toMatch(/Lou Gehrig Fan Club/);
    expect(body.batch_id).toBe('batch-42');

    const row = sqlite.prepare('SELECT photo_id, source, rights_hold, publication_eligible, tags, rights_notes FROM photos').get() as {
      photo_id: string;
      source: string;
      rights_hold: number;
      publication_eligible: number;
      tags: string;
      rights_notes: string;
    };
    expect(row.rights_hold).toBe(1);
    expect(row.publication_eligible).toBe(0);
    expect(row.tags).toContain('bulk_batch:batch-42');
    expect(row.source).toMatch(/Lou Gehrig Fan Club/);
    const notes = JSON.parse(row.rights_notes);
    expect(notes.rights_class).toBe('lgfc_collection');
    expect(notes.unpublished).toBe(true);
  });

  it('stores someone_elses with source and never LGFC credit', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b2', rights_class: 'someone_elses', source: 'Estate collection' },
        { bytes: ORDINARY_PNG, name: 'scan.png', type: 'image/png' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.credit_line).toBeNull();
    expect(body.rights_class).toBe('someone_elses');
    const row = sqlite.prepare('SELECT source, rights_notes FROM photos').get() as {
      source: string;
      rights_notes: string;
    };
    expect(row.source).toBe('Estate collection');
    expect(row.source).not.toMatch(/Lou Gehrig/i);
    const notes = JSON.parse(row.rights_notes);
    expect(notes.rights_holder).toBeNull();
  });

  it('skips an exact duplicate by content SHA', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    mockB2Put();
    const fields = { batch_id: 'b3', rights_class: 'lgfc_collection' };
    const file = { bytes: ORDINARY_PNG, name: 'a.png', type: 'image/png' };
    const first = await onRequestPost({
      request: formRequest(fields, file, ADMIN_SESSION_COOKIE),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(first.status).toBe(201);
    const second = await onRequestPost({
      request: formRequest({ ...fields, batch_id: 'b3b' }, file, ADMIN_SESSION_COOKIE),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.status).toBe('exact_duplicate_skipped');
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('denies a screenshot file name', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    const fetchSpy = mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b4', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'Screenshot 2026-11-20.png', type: 'image/png' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('screenshot_denied');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flags flat-copy look-alike names but still stores unpublished', async () => {
    const { sqlite, db } = freshDb();
    seedAdminSession(sqlite);
    mockB2Put();
    const res = await onRequestPost({
      request: formRequest(
        { batch_id: 'b5', rights_class: 'lgfc_collection' },
        { bytes: ORDINARY_PNG, name: 'baseball_card_front.png', type: 'image/png' },
        ADMIN_SESSION_COOKIE,
      ),
      env: { DB: withAdminSession(db), ...B2_ENV },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.flat_copy_flagged).toBe(true);
    expect(body.rights_hold).toBe(true);
    const row = sqlite.prepare('SELECT tags FROM photos').get() as { tags: string };
    expect(row.tags).toContain('flat_copy_review');
  });
});
