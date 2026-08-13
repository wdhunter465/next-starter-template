import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestPost } from '../../functions/api/admin/member-operations/delete';

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

function seedMember(sqlite: DatabaseSync, email = 'member@example.com') {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at) VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO join_requests (name, email, created_at) VALUES ('Member Name', '${email}', datetime('now'));
  `);
}

function deleteRequest(body: unknown, token = ADMIN_TOKEN): Request {
  return new Request('https://www.lougehrigfanclub.com/api/admin/member-operations/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/member-operations/delete (#2919, F6 soft deletion)', () => {
  it('soft-deletes a member and mirrors deletion onto join_requests, without removing rows', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'Member requested account deletion by email.',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(200);

    const member = sqlite.prepare('SELECT deleted_at, deletion_reason, deleted_by FROM members WHERE email = ?').get('member@example.com') as Record<string, unknown>;
    expect(member.deleted_at).toBeTruthy();
    expect(member.deletion_reason).toContain('requested account deletion');
    expect(member.deleted_by).toBe('admin@lougehrigfanclub.com');

    const joinRequest = sqlite.prepare('SELECT deleted_at FROM join_requests WHERE email = ?').get('member@example.com') as { deleted_at: unknown };
    expect(joinRequest.deleted_at).toBeTruthy();

    // Row still exists — this is soft deletion, not destructive.
    const countRow = sqlite.prepare('SELECT COUNT(*) AS n FROM members WHERE email = ?').get('member@example.com') as { n: number };
    expect(countRow.n).toBe(1);
  });

  it('is reversible via action: restore', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'test',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);

    const res = await onRequestPost({
      request: deleteRequest({ email: 'member@example.com', action: 'restore' }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(200);

    const member = sqlite.prepare('SELECT deleted_at FROM members WHERE email = ?').get('member@example.com') as { deleted_at: unknown };
    expect(member.deleted_at).toBeNull();
  });

  it('fails closed (400) when deletion_reason or deleted_by is missing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest({ email: 'member@example.com' }),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(400);

    const member = sqlite.prepare('SELECT deleted_at FROM members WHERE email = ?').get('member@example.com') as { deleted_at: unknown };
    expect(member.deleted_at).toBeNull();
  });

  it('returns 409 when deleting an already-deleted member', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const body = { email: 'member@example.com', deletion_reason: 'x', deleted_by: 'admin@lougehrigfanclub.com' };

    await onRequestPost({ request: deleteRequest(body), env: { DB: db, ADMIN_TOKEN } } as any);
    const res = await onRequestPost({ request: deleteRequest(body), env: { DB: db, ADMIN_TOKEN } } as any);
    expect(res.status).toBe(409);
  });

  it('rejects requests without a valid admin token', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest(
        { email: 'member@example.com', deletion_reason: 'x', deleted_by: 'y' },
        'wrong-token',
      ),
      env: { DB: db, ADMIN_TOKEN },
    } as any);
    expect(res.status).toBe(401);
  });
});
