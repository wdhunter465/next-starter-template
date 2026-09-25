// @vitest-environment node
// #4261: governed admin cleanup for PURGE_ELIGIBLE photos rows.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet as purgeEligibleGet } from '../../functions/api/admin/photos/purge-eligible';
import { onRequestPost as purgePost } from '../../functions/api/admin/photos/purge';
import { ADMIN_SESSION_COOKIE, withAdminSession } from '../helpers/adminSession';

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

function getRequest(cookie: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/photos/purge-eligible', { headers });
}

function postRequest(cookie: string | null, body: unknown): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/photos/purge', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seedPhotos(sqlite: DatabaseSync) {
  // A clean, unreferenced, correctly-flagged PURGE_ELIGIBLE row -> purgeable.
  sqlite.exec(`
    INSERT INTO photos (id, url, is_matchup_eligible, rights_notes, rights_hold, publication_eligible)
    VALUES (1, 'https://example.test/1.jpg', -1, 'PURGE_ELIGIBLE: B2 object missing during deletion reconciliation (#2519); key=k1', 0, 0);
  `);
  // Same PURGE_ELIGIBLE marker, but still referenced by content_inventory_media -> blocked.
  sqlite.exec(`
    INSERT INTO photos (id, url, is_matchup_eligible, rights_notes, rights_hold, publication_eligible)
    VALUES (2, 'https://example.test/2.jpg', -1, 'PURGE_ELIGIBLE: B2 object missing during deletion reconciliation (#2519); key=k2', 0, 0);
    INSERT INTO content_inventory (tag, title, text, credit_line) VALUES ('t2', 'Title 2', 'body', 'credit');
    INSERT INTO content_inventory_media (story_id, media_id, media_role)
    VALUES ((SELECT id FROM content_inventory WHERE tag = 't2'), 2, 'primary_image');
  `);
  // Not soft-retired at all -> not_purge_eligible.
  sqlite.exec(`
    INSERT INTO photos (id, url, is_matchup_eligible, rights_hold, publication_eligible)
    VALUES (3, 'https://example.test/3.jpg', 1, 0, 1);
  `);
}

describe('GET /api/admin/photos/purge-eligible (#4261)', () => {
  it('requires an admin session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await purgeEligibleGet({ env: { DB: wrapSqliteAsD1(sqlite) }, request: getRequest(null) });
    expect(response.status).toBe(401);
  });

  it('rejects a non-admin member', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await purgeEligibleGet({
      env: { DB: withAdminSession(wrapSqliteAsD1(sqlite), 'member') },
      request: getRequest(ADMIN_SESSION_COOKIE),
    });
    expect(response.status).toBe(403);
  });

  it('lists PURGE_ELIGIBLE rows and flags referenced ones as not purgeable', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedPhotos(sqlite);

    const response = await purgeEligibleGet({
      env: { DB: withAdminSession(wrapSqliteAsD1(sqlite)) },
      request: getRequest(ADMIN_SESSION_COOKIE),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const ids = body.items.map((row: { id: number }) => row.id);
    expect(ids).toEqual([1, 2]); // row 3 was never soft-retired, so it's not a candidate at all

    const clean = body.items.find((row: { id: number }) => row.id === 1);
    expect(clean.purgeable).toBe(true);
    expect(clean.references.content_inventory_media).toBe(0);

    const blocked = body.items.find((row: { id: number }) => row.id === 2);
    expect(blocked.purgeable).toBe(false);
    expect(blocked.references.content_inventory_media).toBe(1);
  });
});

describe('POST /api/admin/photos/purge (#4261)', () => {
  it('requires an admin session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await purgePost({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: postRequest(null, { ids: [1], confirm: 'PURGE' }),
    });
    expect(response.status).toBe(401);
  });

  it('rejects without the literal confirm token', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedPhotos(sqlite);
    const response = await purgePost({
      env: { DB: withAdminSession(wrapSqliteAsD1(sqlite)) },
      request: postRequest(ADMIN_SESSION_COOKIE, { ids: [1] }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('confirm_required');
  });

  it('rejects an empty ids list', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await purgePost({
      env: { DB: withAdminSession(wrapSqliteAsD1(sqlite)) },
      request: postRequest(ADMIN_SESSION_COOKIE, { ids: [], confirm: 'PURGE' }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('ids_required');
  });

  it('purges only the clean unreferenced row and reports why the others were skipped', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedPhotos(sqlite);

    const response = await purgePost({
      env: { DB: withAdminSession(wrapSqliteAsD1(sqlite)) },
      request: postRequest(ADMIN_SESSION_COOKIE, { ids: [1, 2, 3, 999], confirm: 'PURGE' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.purged).toBe(1);

    const byId = new Map(body.results.map((r: { id: number; status: string }) => [r.id, r.status]));
    expect(byId.get(1)).toBe('purged');
    expect(byId.get(2)).toBe('blocked_referenced');
    expect(byId.get(3)).toBe('not_purge_eligible');
    expect(byId.get(999)).toBe('not_found');

    const remaining = sqlite.prepare('SELECT id FROM photos ORDER BY id').all() as Array<{ id: number }>;
    expect(remaining.map((r) => r.id)).toEqual([2, 3]);
  });
});
