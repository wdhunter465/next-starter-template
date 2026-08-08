import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet as publicPhotosGet } from '../functions/api/photos';
import { onRequestGet as memberPhotosGet } from '../functions/api/fanclub/photos';

const PENDING_PHOTO_SCHEMA_MIGRATION = '0045_member_photo_pending_status_and_rate_limit.sql';

function applyMigrations(db: DatabaseSync, { excludeFiles = [] as string[] } = {}) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !excludeFiles.includes(file))
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

function seedGalleryRows(sqlite: DatabaseSync, withStatus: boolean) {
  if (withStatus) {
    sqlite.exec(`
      INSERT INTO photos (url, title, description, tags, is_memorabilia, status, source)
      VALUES
        ('published/legacy.jpg', 'Legacy Published', 'staff managed', 'yankees,lou', 0, 'published', 'staff'),
        ('pending/member.jpg', 'Pending Member', 'awaiting review', 'member,upload', 0, 'pending', 'member@example.com'),
        ('rejected/member.jpg', 'Rejected Member', 'not approved', 'member', 0, 'rejected', 'member@example.com'),
        ('published/memo.jpg', 'Memorabilia', 'signed ball', 'memorabilia', 1, 'published', 'staff'),
        ('pending/memo.jpg', 'Pending Memo', 'hidden memo', 'memorabilia', 1, 'pending', 'member@example.com')
    `);
  } else {
    sqlite.exec(`
      INSERT INTO photos (url, title, description, tags, is_memorabilia, source)
      VALUES
        ('legacy/a.jpg', 'Legacy A', 'staff managed', 'yankees', 0, 'staff'),
        ('legacy/b.jpg', 'Legacy B', 'another', 'lou', 0, 'staff')
    `);
  }
}

function seedMemberSession(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT OR IGNORE INTO members (email, role) VALUES ('member@example.com', 'member');
    INSERT INTO member_sessions (id, email, expires_at)
    VALUES ('test-session-2899', 'member@example.com', datetime('now', '+1 day'));
  `);
}

function publicContext(db: any, pathAndQuery: string) {
  return {
    env: { DB: db, PUBLIC_B2_BASE_URL: 'https://cdn.example.test/' },
    request: new Request(`https://www.lougehrigfanclub.com${pathAndQuery}`),
  };
}

function memberContext(db: any, pathAndQuery: string) {
  return {
    env: { DB: db, PUBLIC_B2_BASE_URL: 'https://cdn.example.test/' },
    request: new Request(`https://www.lougehrigfanclub.com${pathAndQuery}`, {
      headers: { Cookie: 'lgfc_session=test-session-2899' },
    }),
  };
}

describe('#2899 photo read visibility — published-only invariant', () => {
  it('keeps legacy/published rows visible on the public API when status exists', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    const db = wrapSqliteAsD1(sqlite);

    const res = await publicPhotosGet(publicContext(db, '/api/photos?limit=50&offset=0'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const urls = (body.items || []).map((row: any) => row.url);
    expect(urls).toContain('https://cdn.example.test/published/legacy.jpg');
    expect(urls).toContain('https://cdn.example.test/published/memo.jpg');
    expect(urls).not.toContain('https://cdn.example.test/pending/member.jpg');
    expect(urls).not.toContain('https://cdn.example.test/rejected/member.jpg');
    expect(urls).not.toContain('https://cdn.example.test/pending/memo.jpg');
    sqlite.close();
  });

  it('excludes pending rows from the public API', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    const db = wrapSqliteAsD1(sqlite);

    const res = await publicPhotosGet(publicContext(db, '/api/photos'));
    const body = await res.json();
    expect((body.items || []).some((row: any) => String(row.url).includes('pending/'))).toBe(false);
    sqlite.close();
  });

  it('excludes pending rows from the member API and from total counts', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?page=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const keys = (body.items || []).map((row: any) => row.b2_key);
    expect(keys).toContain('published/legacy.jpg');
    expect(keys).not.toContain('pending/member.jpg');
    expect(keys).not.toContain('rejected/member.jpg');
    // memorabilia rows are excluded by existing member gallery predicate
    expect(keys).not.toContain('published/memo.jpg');
    expect(body.total).toBe(1);
    sqlite.close();
  });

  it('composes published visibility with memorabilia filter on the public API', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    const db = wrapSqliteAsD1(sqlite);

    const res = await publicPhotosGet(publicContext(db, '/api/photos?memorabilia=1'));
    const body = await res.json();
    const urls = (body.items || []).map((row: any) => row.url);
    expect(urls).toEqual(['https://cdn.example.test/published/memo.jpg']);
    sqlite.close();
  });

  it('composes published visibility with member query/tag filters', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const byQuery = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?q=legacy'));
    const queryBody = await byQuery.json();
    expect(queryBody.total).toBe(1);
    expect(queryBody.items[0].b2_key).toBe('published/legacy.jpg');

    const byTag = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?tags=yankees'));
    const tagBody = await byTag.json();
    expect(tagBody.total).toBe(1);
    expect(tagBody.items[0].b2_key).toBe('published/legacy.jpg');

    // Pending row also has tag "member" but must not match once status filter applies
    const pendingTag = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?tags=member'));
    const pendingBody = await pendingTag.json();
    expect(pendingBody.total).toBe(0);
    expect(pendingBody.items).toEqual([]);
    sqlite.close();
  });

  it('does not count hidden pending rows toward member pagination totals', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite);
    seedGalleryRows(sqlite, true);
    // Add enough published non-memorabilia rows to exercise paging math
    for (let i = 0; i < 30; i++) {
      sqlite.exec(
        `INSERT INTO photos (url, title, is_memorabilia, status) VALUES ('published/page-${i}.jpg', 'P${i}', 0, 'published')`
      );
    }
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const page1 = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?page=1'));
    const body1 = await page1.json();
    // 1 legacy published + 30 page rows = 31 published non-memorabilia; pending/rejected excluded
    expect(body1.total).toBe(31);
    expect(body1.items).toHaveLength(24);

    const page2 = await memberPhotosGet(memberContext(db, '/api/fanclub/photos?page=2'));
    const body2 = await page2.json();
    expect(body2.total).toBe(31);
    expect(body2.items).toHaveLength(7);
    expect((body2.items || []).some((row: any) => String(row.b2_key).includes('pending/'))).toBe(false);
    sqlite.close();
  });

  it('preserves pre-schema catalog reads without inventing a pending exposure path', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite, { excludeFiles: [PENDING_PHOTO_SCHEMA_MIGRATION] });
    seedGalleryRows(sqlite, false);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const publicRes = await publicPhotosGet(publicContext(db, '/api/photos'));
    const publicBody = await publicRes.json();
    expect(publicBody.items).toHaveLength(2);

    const memberRes = await memberPhotosGet(memberContext(db, '/api/fanclub/photos'));
    const memberBody = await memberRes.json();
    expect(memberBody.total).toBe(2);
    expect(memberBody.items).toHaveLength(2);
    sqlite.close();
  });

  it('filters on status even when only the status column is present (partial schema)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyMigrations(sqlite, { excludeFiles: [PENDING_PHOTO_SCHEMA_MIGRATION] });
    sqlite.exec(`ALTER TABLE photos ADD COLUMN status TEXT NOT NULL DEFAULT 'published'`);
    sqlite.exec(`
      INSERT INTO photos (url, title, is_memorabilia, status)
      VALUES
        ('published/only-status.jpg', 'Visible', 0, 'published'),
        ('pending/only-status.jpg', 'Hidden', 0, 'pending')
    `);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const publicRes = await publicPhotosGet(publicContext(db, '/api/photos'));
    const publicBody = await publicRes.json();
    expect(publicBody.items).toHaveLength(1);
    expect(publicBody.items[0].url).toContain('published/only-status.jpg');

    const memberRes = await memberPhotosGet(memberContext(db, '/api/fanclub/photos'));
    const memberBody = await memberRes.json();
    expect(memberBody.total).toBe(1);
    expect(memberBody.items[0].b2_key).toBe('published/only-status.jpg');
    sqlite.close();
  });
});
