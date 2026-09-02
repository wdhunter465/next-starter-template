// #2073 Work Package item 4 (#4061): admin API for archive-item intake and
// custody transitions.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet as archiveItemsGet, onRequestPost as archiveItemsPost } from '../functions/api/admin/archive-items/index';
import { onRequestPost as custodyPost } from '../functions/api/admin/archive-items/custody';
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
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
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
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      };
    },
  };
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

function freshAdminDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyRepoMigrations(sqlite);
  seedAdminSession(sqlite);
  return wrapSqliteAsD1(sqlite);
}

describe('POST /api/admin/archive-items', () => {
  it('returns 401 without admin authorization', async () => {
    const response = await archiveItemsPost({
      env: { DB: {} },
      request: adminPostRequest('/api/admin/archive-items', {}, null),
    });
    expect(response.status).toBe(401);
  });

  it('rejects a loan without loan_expected_return_at', async () => {
    const db = freshAdminDb();
    const response = await archiveItemsPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items', {
        title: 'Loaned scrapbook',
        summary: 'x',
        item_type: 'document',
        custody_type: 'loan',
        actor: 'Bill',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('creates an archive item and it appears in the GET list', async () => {
    const db = freshAdminDb();

    const postResponse = await archiveItemsPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items', {
        title: 'Gehrig 1927 program',
        summary: 'Donated game program.',
        item_type: 'document',
        custody_type: 'donation',
        donor_name: 'Jane Donor',
        donor_contact: 'jane@example.com',
        donor_consent_public_credit: true,
        credit_line: 'Gift of Jane Donor',
        actor: 'Bill',
      }),
    });
    expect(postResponse.status).toBe(201);
    const postBody = await postResponse.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.item.custody_state).toBe('offered');
    expect(postBody.item.donor_contact).toBe('jane@example.com');

    const getResponse = await archiveItemsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/archive-items'),
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.count).toBe(1);
    expect(getBody.items[0].id).toBe(postBody.item.id);
  });

  it('offset=N actually skips N rows (regression: offset used to be shifted by one)', async () => {
    const db = freshAdminDb();

    for (const title of ['First item', 'Second item', 'Third item']) {
      await archiveItemsPost({
        env: { DB: db },
        request: adminPostRequest('/api/admin/archive-items', {
          title,
          summary: 'x',
          item_type: 'document',
          custody_type: 'donation',
          actor: 'Bill',
        }),
      });
    }

    const allResponse = await archiveItemsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/archive-items'),
    });
    const all = (await allResponse.json()).items as Array<{ id: number }>;
    expect(all.length).toBe(3);

    const offsetZero = await archiveItemsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/archive-items?offset=0'),
    });
    expect((await offsetZero.json()).items).toEqual(all);

    const offsetOne = await archiveItemsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/archive-items?offset=1'),
    });
    const afterOffsetOne = (await offsetOne.json()).items as Array<{ id: number }>;
    expect(afterOffsetOne).toEqual(all.slice(1));

    const offsetTwo = await archiveItemsGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/archive-items?offset=2'),
    });
    expect((await offsetTwo.json()).items).toEqual(all.slice(2));
  });
});

describe('POST /api/admin/archive-items/custody', () => {
  it('returns 401 without admin authorization', async () => {
    const response = await custodyPost({
      env: { DB: {} },
      request: adminPostRequest('/api/admin/archive-items/custody', {}, null),
    });
    expect(response.status).toBe(401);
  });

  it('advances custody state and rejects an invalid transition', async () => {
    const db = freshAdminDb();

    const createResponse = await archiveItemsPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items', {
        title: 'Donated photo',
        summary: 'x',
        item_type: 'photograph',
        custody_type: 'donation',
        actor: 'Bill',
      }),
    });
    const created = (await createResponse.json()).item;

    const advanceResponse = await custodyPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items/custody', {
        archive_item_id: created.id,
        to_state: 'received',
        actor: 'Bill',
        note: 'Arrived by mail.',
      }),
    });
    expect(advanceResponse.status).toBe(200);
    expect((await advanceResponse.json()).item.custody_state).toBe('received');

    const invalidResponse = await custodyPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items/custody', {
        archive_item_id: created.id,
        to_state: 'offered',
        actor: 'Bill',
      }),
    });
    expect(invalidResponse.status).toBe(400);
  });

  it('returns 404 for an archive item that does not exist', async () => {
    const db = freshAdminDb();
    const response = await custodyPost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/archive-items/custody', {
        archive_item_id: 999999,
        to_state: 'received',
        actor: 'Bill',
      }),
    });
    expect(response.status).toBe(404);
  });
});
