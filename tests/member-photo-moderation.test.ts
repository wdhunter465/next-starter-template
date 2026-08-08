import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  listPendingPhotos,
  publishedKeyFromQuarantine,
  reviewPendingPhoto,
} from '../functions/_lib/member-photo-moderation';
import { onRequestGet as adminList } from '../functions/api/admin/photos/list';
import { onRequestPost as adminReview } from '../functions/api/admin/photos/review';

function applyMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
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

describe('#2900 member photo moderation', () => {
  it('maps quarantine keys to published keys without leaking quarantine path', () => {
    expect(publishedKeyFromQuarantine('member-photos/quarantine/2026/08/abc.jpg')).toBe(
      'member-photos/published/2026/08/abc.jpg',
    );
  });

  it('lists only pending rows once the schema exists', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    sqlite.exec(`
      INSERT INTO photos (url, status, submitted_by, quarantine_key, consent_confirmed, credit_line)
      VALUES
        ('member-photos/quarantine/a.jpg', 'pending', 'a@example.com', 'member-photos/quarantine/a.jpg', 1, 'Photo by a'),
        ('published/legacy.jpg', 'published', NULL, NULL, 0, NULL),
        ('member-photos/quarantine/b.jpg', 'rejected', 'b@example.com', 'member-photos/quarantine/b.jpg', 1, 'Photo by b')
    `);
    const db = wrapSqliteAsD1(sqlite);
    const result = await listPendingPhotos(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].submitted_by).toBe('a@example.com');
    sqlite.close();
  });

  it('approves pending rows to published with reviewer metadata (offline promote skip)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    sqlite.exec(`
      INSERT INTO photos (url, status, submitted_by, quarantine_key, consent_confirmed, credit_line)
      VALUES ('member-photos/quarantine/a.jpg', 'pending', 'a@example.com', 'member-photos/quarantine/a.jpg', 1, 'Photo by a')
    `);
    const db = wrapSqliteAsD1(sqlite);
    const result = await reviewPendingPhoto(db, {}, {
      photoId: 1,
      action: 'approve',
      reviewer: 'mod@example.com',
      notes: 'looks good',
      skipObjectPromote: true,
    });
    expect(result.ok).toBe(true);
    const row = sqlite.prepare(`SELECT status, url, reviewed_by, moderation_notes FROM photos WHERE id = 1`).get() as any;
    expect(row.status).toBe('published');
    expect(String(row.url)).toBe('member-photos/published/a.jpg');
    expect(row.reviewed_by).toBe('mod@example.com');
    expect(row.moderation_notes).toBe('looks good');
    sqlite.close();
  });

  it('rejects pending rows without publishing them', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    sqlite.exec(`
      INSERT INTO photos (url, status, submitted_by, quarantine_key, consent_confirmed)
      VALUES ('member-photos/quarantine/a.jpg', 'pending', 'a@example.com', 'member-photos/quarantine/a.jpg', 1)
    `);
    const db = wrapSqliteAsD1(sqlite);
    const result = await reviewPendingPhoto(db, {}, {
      photoId: 1,
      action: 'reject',
      reviewer: 'mod@example.com',
      notes: 'rights unclear',
    });
    expect(result.ok).toBe(true);
    const row = sqlite.prepare(`SELECT status FROM photos WHERE id = 1`).get() as any;
    expect(row.status).toBe('rejected');
    sqlite.close();
  });

  it('returns 409 when a concurrent review already transitioned the row', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    sqlite.exec(`
      INSERT INTO photos (url, status, submitted_by, quarantine_key, consent_confirmed)
      VALUES ('member-photos/quarantine/a.jpg', 'pending', 'a@example.com', 'member-photos/quarantine/a.jpg', 1)
    `);
    const db = wrapSqliteAsD1(sqlite);
    await reviewPendingPhoto(db, {}, {
      photoId: 1,
      action: 'reject',
      reviewer: 'first@example.com',
    });
    const second = await reviewPendingPhoto(db, {}, {
      photoId: 1,
      action: 'approve',
      reviewer: 'second@example.com',
      skipObjectPromote: true,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe('NOT_PENDING');
      expect(second.status).toBe(409);
    }
    sqlite.close();
  });

  it('admin list/review handlers enforce admin token and review transitions', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    sqlite.exec(`
      INSERT INTO photos (url, status, submitted_by, quarantine_key, consent_confirmed)
      VALUES ('member-photos/quarantine/a.jpg', 'pending', 'a@example.com', 'member-photos/quarantine/a.jpg', 1)
    `);
    const db = wrapSqliteAsD1(sqlite);
    const env = { DB: db, ADMIN_TOKEN: 'secret-token' };

    const denied = await adminList({
      env,
      request: new Request('https://example.test/api/admin/photos/list'),
    });
    expect(denied.status).toBe(401);

    const listed = await adminList({
      env,
      request: new Request('https://example.test/api/admin/photos/list', {
        headers: { 'x-admin-token': 'secret-token' },
      }),
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.items).toHaveLength(1);

    const reviewed = await adminReview({
      env,
      request: new Request('https://example.test/api/admin/photos/review', {
        method: 'POST',
        headers: { 'x-admin-token': 'secret-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: 1, action: 'approve', reviewer: 'mod@example.com', skip_object_promote: true }),
      }),
    });
    expect(reviewed.status).toBe(200);
    const reviewedBody = await reviewed.json();
    expect(reviewedBody.status).toBe('published');
    sqlite.close();
  });
});
