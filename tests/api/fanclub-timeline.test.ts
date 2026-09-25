// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet } from '../../functions/api/fanclub/timeline';

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

function seedMemberSession(sqlite: DatabaseSync, sessionId = 'session-3161', email = 'member@example.com') {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function getRequest(cookie: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/fanclub/timeline', { headers });
}

describe('GET /api/fanclub/timeline (#3161)', () => {
  it('requires a member session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await onRequestGet({ env: { DB: wrapSqliteAsD1(sqlite) }, request: getRequest(null) });
    expect(response.status).toBe(401);
  });

  it('returns both public and member-visibility milestones with full detail, seeded by migration 0078', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);

    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-3161'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);

    const eventTypes = new Set(body.items.map((row: { event_type: string }) => row.event_type));
    expect(eventTypes.has('marriage')).toBe(true);
    expect(eventTypes.has('graduation')).toBe(true);
    expect(eventTypes.has('birth')).toBe(true);
    expect(eventTypes.has('death')).toBe(true);

    const marriage = body.items.find((row: { title: string }) => row.title === 'Marries Eleanor Grace Twitchell');
    expect(marriage).toMatchObject({
      event_date: '1933-09-29',
      event_type: 'marriage',
    });
    expect(marriage.detail_body).toMatch(/Eleanor Twitchell/);
    expect(marriage.source_url).toBeTruthy();

    // Chronological order, oldest first.
    const dated = body.items.filter((row: { event_date: string | null }) => row.event_date);
    const dates = dated.map((row: { event_date: string }) => row.event_date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('returns 503 when the milestones table is missing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    sqlite.exec('DROP TABLE milestones;');

    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-3161'),
    });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });
});
