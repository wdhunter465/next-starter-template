import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { publishedInventoryWhere } from '../functions/_lib/content-inventory-public';
import { onRequestPost } from '../functions/api/admin/editorial/suppress';

const ADMIN_TOKEN = 'test-admin-token';

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

function insertPublishedContentRow(sqlite: DatabaseSync): number {
  sqlite.exec(`
    INSERT INTO content_inventory (tag, title, text, source_name, credit_line, status, allowed_sections, published_at)
    VALUES (
      'lou-gehrig-day-1939-p109',
      'Lou Gehrig Day',
      'Full account of the ceremony.',
      'LGFC Library',
      'LGFC Library',
      'published',
      '["club_home","library"]',
      datetime('now')
    );
  `);
  const row = sqlite.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
  return row.id;
}

function suppressRequest(body: unknown, token = ADMIN_TOKEN): Request {
  return new Request('https://www.lougehrigfanclub.com/api/admin/editorial/suppress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/editorial/suppress (#3382 P1-09 / #2919 F5)', () => {
  it('archives the record and records auditable takedown evidence', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const id = insertPublishedContentRow(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: suppressRequest({
        content_inventory_id: id,
        suppression_reason: 'Rights holder requested removal by email 2026-08-13.',
        takedown_request_source: 'Support@LouGehrigFanClub.com email from J. Smith',
        takedown_resolution_note: 'Archived pending legal confirmation.',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    const json = (await res.json()) as { ok: boolean; status?: string };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('archived');

    const row = sqlite
      .prepare(
        `SELECT status, published_at, suppression_reason, takedown_request_source, takedown_resolution_note, takedown_requested_at
           FROM content_inventory WHERE id = ?`,
      )
      .get(id) as Record<string, unknown>;
    expect(row.status).toBe('archived');
    expect(row.published_at).toBeNull();
    expect(row.suppression_reason).toContain('Rights holder requested removal');
    expect(row.takedown_request_source).toContain('Support@LouGehrigFanClub.com');
    expect(row.takedown_resolution_note).toContain('Archived pending');
    expect(row.takedown_requested_at).toBeTruthy();
  });

  it('fails closed (400) when suppression_reason is missing and leaves row published', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const id = insertPublishedContentRow(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: suppressRequest({
        content_inventory_id: id,
        takedown_request_source: 'Support email',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(400);

    const row = sqlite.prepare('SELECT status FROM content_inventory WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('published');
  });

  it('returns 404 for an unknown content_inventory_id', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: suppressRequest({
        content_inventory_id: 999999,
        suppression_reason: 'Rights holder requested removal.',
        takedown_request_source: 'Support email',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(404);
  });

  it('rejects requests without a valid admin token', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const id = insertPublishedContentRow(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: suppressRequest(
        { content_inventory_id: id, suppression_reason: 'x', takedown_request_source: 'y' },
        'wrong-token',
      ),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(401);
  });

  it('never hard-deletes the inventory row', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const id = insertPublishedContentRow(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await onRequestPost({
      request: suppressRequest({
        content_inventory_id: id,
        suppression_reason: 'Takedown',
        takedown_request_source: 'email',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);

    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM content_inventory WHERE id = ?').get(id) as { n: number };
    expect(count.n).toBe(1);
  });

  it('fail-closes Club Home published selection after suppress (status gate)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const id = insertPublishedContentRow(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const before = sqlite
      .prepare(`SELECT id FROM content_inventory WHERE id = ? AND ${publishedInventoryWhere('club_home')}`)
      .get(id);
    expect(before).toBeTruthy();

    await onRequestPost({
      request: suppressRequest({
        content_inventory_id: id,
        suppression_reason: 'Takedown',
        takedown_request_source: 'email',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);

    const after = sqlite
      .prepare(`SELECT id FROM content_inventory WHERE id = ? AND ${publishedInventoryWhere('club_home')}`)
      .get(id);
    expect(after).toBeUndefined();
  });
});
