// #2901 (#2857 Task 004) — proves the rollback story #2857 defines: "Rollback
// disables member upload, preserves pending evidence under approved
// retention, and restores existing staff-managed gallery behavior."
//
// The upload route (functions/api/fanclub/photos/upload.ts) calls
// requireB2(env) immediately after auth and fails closed with a 503 before
// any rate-limit check, form parse, or D1 write when B2 write credentials
// are absent — the same env shape as a Production environment with member
// upload deliberately disabled. None of the gallery/detail read routes call
// requireB2 at all, so they are unaffected by that same env shape. This test
// exercises both halves of that claim against the real route handlers,
// rather than asserting it from documentation alone.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestPost as uploadPost } from '../functions/api/fanclub/photos/upload';
import { onRequestGet as publicPhotosGet } from '../functions/api/photos';
import { onRequestGet as memberPhotosGet } from '../functions/api/fanclub/photos';
import { onRequestGet as photoDetailGet } from '../functions/api/photos/get';

function applyMigrations(db: DatabaseSync) {
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
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind: (...args: any[]) => ({
          async first() {
            return stmt.get(...args) ?? null;
          },
          async all() {
            return { results: stmt.all(...args) };
          },
          async run() {
            const result = stmt.run(...args);
            return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
          },
        }),
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          const result = stmt.run();
          return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
        },
      };
    },
  };
}

function seedStaffManagedGallery(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO photos (url, title, description, tags, is_memorabilia, status, source)
    VALUES
      ('published/staff-a.jpg', 'Staff A', 'staff managed', 'yankees,lou', 0, 'published', 'staff'),
      ('published/staff-b.jpg', 'Staff B', 'staff managed', 'yankees', 0, 'published', 'staff')
  `);
}

function seedMemberSession(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT OR IGNORE INTO members (email, role) VALUES ('member@example.com', 'member');
    INSERT INTO member_sessions (id, email, expires_at)
    VALUES ('test-session-2901', 'member@example.com', datetime('now', '+1 day'));
  `);
}

/** Env shape with B2 write credentials absent — the rollback/"member upload disabled" state. */
function envWithoutB2Credentials(db: any) {
  return { DB: db, PUBLIC_B2_BASE_URL: 'https://cdn.example.test/' };
}

function memberUploadRequest() {
  return new Request('https://www.lougehrigfanclub.com/api/fanclub/photos/upload', {
    method: 'POST',
    headers: { Cookie: 'lgfc_session=test-session-2901' },
  });
}

function memberGalleryRequest(pathAndQuery: string) {
  return new Request(`https://www.lougehrigfanclub.com${pathAndQuery}`, {
    headers: { Cookie: 'lgfc_session=test-session-2901' },
  });
}

describe('#2901 rollback proof: member upload disabled (B2 write credentials absent)', () => {
  it('fails the upload route closed with STORAGE_UNAVAILABLE, before any D1 write', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const before = sqlite.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number };
    expect(before.n).toBe(0);

    const res = await uploadPost({ env: envWithoutB2Credentials(db), request: memberUploadRequest() });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('STORAGE_UNAVAILABLE');

    const after = sqlite.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number };
    expect(after.n).toBe(0);
    sqlite.close();
  });

  it('still requires authentication before reporting storage-unavailable (auth check is not bypassed by rollback state)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const unauthenticatedRequest = new Request('https://www.lougehrigfanclub.com/api/fanclub/photos/upload', {
      method: 'POST',
    });
    const res = await uploadPost({ env: envWithoutB2Credentials(db), request: unauthenticatedRequest });
    expect(res.status).toBe(401);
    sqlite.close();
  });
});

describe('#2901 rollback proof: staff-managed gallery behavior is preserved when upload is disabled', () => {
  it('keeps the public gallery fully functional', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedStaffManagedGallery(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await publicPhotosGet({
      env: envWithoutB2Credentials(db),
      request: new Request('https://www.lougehrigfanclub.com/api/photos?limit=50&offset=0'),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const urls = (body.items || []).map((row: any) => row.url);
    expect(urls).toContain('https://cdn.example.test/published/staff-a.jpg');
    expect(urls).toContain('https://cdn.example.test/published/staff-b.jpg');
    sqlite.close();
  });

  it('keeps the member gallery fully functional', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedStaffManagedGallery(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await memberPhotosGet({ env: envWithoutB2Credentials(db), request: memberGalleryRequest('/api/fanclub/photos?page=1') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    const keys = (body.items || []).map((row: any) => row.b2_key);
    expect(keys).toContain('published/staff-a.jpg');
    expect(keys).toContain('published/staff-b.jpg');
    sqlite.close();
  });

  it('keeps the photo-detail route fully functional for a published staff-managed photo', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedStaffManagedGallery(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const row = sqlite.prepare("SELECT id FROM photos WHERE url = 'published/staff-a.jpg'").get() as { id: number };

    const res = await photoDetailGet({
      env: envWithoutB2Credentials(db),
      params: {},
      request: new Request(`https://www.lougehrigfanclub.com/api/photos/get?id=${row.id}`),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.item.url).toBe('https://cdn.example.test/published/staff-a.jpg');
    sqlite.close();
  });
});
