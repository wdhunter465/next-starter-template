import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestPost } from '../../functions/api/admin/member-operations/delete';
import { onRequestPost as loginPost } from '../../functions/api/login';
import { getSessionEmail } from '../../functions/_lib/session';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from '../helpers/adminSqliteSession';

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

function seedMemberSession(
  sqlite: DatabaseSync,
  email = 'member@example.com',
  sessionId = 'member-session-id',
): string {
  sqlite
    .prepare(
      `INSERT INTO member_sessions (id, email, expires_at)
         VALUES (?, ?, datetime('now', '+1 day'))`,
    )
    .run(sessionId, email);
  return sessionId;
}

function loginRequest(email: string, ip = '203.0.113.10'): Request {
  return new Request('https://www.lougehrigfanclub.com/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({ email }),
  });
}

function deleteRequest(body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/member-operations/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/member-operations/delete (#2919, F6 soft deletion)', () => {
  it('soft-deletes a member and mirrors deletion onto join_requests, without removing rows', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'Member requested account deletion by email.',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db },
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
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'test',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db },
    } as any);

    const res = await onRequestPost({
      request: deleteRequest({ email: 'member@example.com', action: 'restore' }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(200);

    const member = sqlite.prepare('SELECT deleted_at FROM members WHERE email = ?').get('member@example.com') as { deleted_at: unknown };
    expect(member.deleted_at).toBeNull();
  });

  it('fails closed (400) when deletion_reason or deleted_by is missing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest({ email: 'member@example.com' }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(400);

    const member = sqlite.prepare('SELECT deleted_at FROM members WHERE email = ?').get('member@example.com') as { deleted_at: unknown };
    expect(member.deleted_at).toBeNull();
  });

  it('returns 409 when deleting an already-deleted member', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const body = { email: 'member@example.com', deletion_reason: 'x', deleted_by: 'admin@lougehrigfanclub.com' };

    await onRequestPost({ request: deleteRequest(body), env: { DB: db } } as any);
    const res = await onRequestPost({ request: deleteRequest(body), env: { DB: db } } as any);
    expect(res.status).toBe(409);
  });

  it('rejects requests without a valid admin session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: deleteRequest(
        { email: 'member@example.com', deletion_reason: 'x', deleted_by: 'y' },
        null,
      ),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(401);
  });

  it('revokes the member session and blocks login while deleted_at is set (#3076)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const memberSessionId = seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const before = await getSessionEmail(db, memberSessionId);
    expect(before).toBe('member@example.com');

    const deleteRes = await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'Member requested account deletion by email.',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db },
    } as any);
    expect(deleteRes.status).toBe(200);

    const remaining = sqlite
      .prepare('SELECT COUNT(*) AS n FROM member_sessions WHERE lower(email) = ?')
      .get('member@example.com') as { n: number };
    expect(remaining.n).toBe(0);

    const after = await getSessionEmail(db, memberSessionId);
    expect(after).toBe('');

    const loginRes = await loginPost({
      request: loginRequest('member@example.com'),
      env: { DB: db },
    } as any);
    expect(loginRes.status).toBe(404);
    const loginBody = (await loginRes.json()) as { error?: string };
    expect(loginBody.error).toBe('Email not found.');
  });

  it('does not revive revoked session IDs on restore; a new login can succeed (#3076)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMember(sqlite);
    seedAdminSession(sqlite);
    const oldSessionId = seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await onRequestPost({
      request: deleteRequest({
        email: 'member@example.com',
        deletion_reason: 'test',
        deleted_by: 'admin@lougehrigfanclub.com',
      }),
      env: { DB: db },
    } as any);

    const restoreRes = await onRequestPost({
      request: deleteRequest({ email: 'member@example.com', action: 'restore' }),
      env: { DB: db },
    } as any);
    expect(restoreRes.status).toBe(200);

    const revived = await getSessionEmail(db, oldSessionId);
    expect(revived).toBe('');

    const loginRes = await loginPost({
      request: loginRequest('member@example.com', '203.0.113.11'),
      env: { DB: db },
    } as any);
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get('Set-Cookie') || '';
    expect(setCookie).toContain('lgfc_session=');
    expect(setCookie).not.toContain(`lgfc_session=${oldSessionId}`);
  });
});
