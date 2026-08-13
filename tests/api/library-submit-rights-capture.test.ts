import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestPost } from '../../functions/api/library/submit';

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
          return { success: true, meta: { last_row_id: Number(sqlite.prepare('SELECT last_insert_rowid() AS id').get()?.id ?? 0) } };
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

function seedMemberSession(db: DatabaseSync, sessionId = 'session-2919', email = 'member@example.com') {
  db.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function submitRequest(body: unknown, sessionId = 'session-2919'): Request {
  return new Request('https://www.lougehrigfanclub.com/api/library/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `lgfc_session=${sessionId}`,
    },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Jane Member',
    title: 'A memory of Lou Gehrig Day',
    content: 'My grandfather told me about attending the original Lou Gehrig Day at Yankee Stadium.',
    ownership_statement: 'I wrote this myself from my own memory.',
    permission_statement: 'LGFC may use this for the Library.',
    credit_preference: 'public_credit',
    ...overrides,
  };
}

describe('POST /api/library/submit rights/consent capture (#2919)', () => {
  it('persists rights fields with consent_status pending on a valid submission', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: submitRequest(validBody()),
      env: { DB: db },
    } as any);
    const json = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    const row = sqlite
      .prepare(
        'SELECT ownership_statement, permission_statement, credit_preference, consent_status FROM submission_queue ORDER BY submission_id DESC LIMIT 1',
      )
      .get() as Record<string, unknown>;
    expect(row.ownership_statement).toBe('I wrote this myself from my own memory.');
    expect(row.permission_statement).toBe('LGFC may use this for the Library.');
    expect(row.credit_preference).toBe('public_credit');
    // Member intake can never self-grant consent; only an admin reviewer may change this.
    expect(row.consent_status).toBe('pending');
  });

  it.each(['ownership_statement', 'permission_statement', 'credit_preference'])(
    'fails closed (400) when %s is missing',
    async (field) => {
      const sqlite = new DatabaseSync(':memory:');
      applyRepoMigrations(sqlite);
      seedMemberSession(sqlite);
      const db = wrapSqliteAsD1(sqlite);

      const res = await onRequestPost({
        request: submitRequest(validBody({ [field]: '' })),
        env: { DB: db },
      } as any);
      const json = (await res.json()) as { ok: boolean };
      expect(res.status).toBe(400);
      expect(json.ok).toBe(false);

      const count = sqlite.prepare('SELECT COUNT(*) AS n FROM submission_queue').get() as { n: number };
      expect(count.n).toBe(0);
    },
  );

  it('fails closed (400) on an invalid credit_preference value', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: submitRequest(validBody({ credit_preference: 'not-a-real-option' })),
      env: { DB: db },
    } as any);
    const json = (await res.json()) as { ok: boolean; error?: string };
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toContain('credit_preference');
  });

  it('rejects an unauthenticated request before touching rights fields', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: new Request('https://www.lougehrigfanclub.com/api/library/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody()),
      }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(401);
  });
});
