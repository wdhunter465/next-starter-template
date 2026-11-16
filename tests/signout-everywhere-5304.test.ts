// @vitest-environment node
// #5304 (item 4 of #4767): sign out everywhere, an admin revoke endpoint, and a guard that any code that
// changes members.role also revokes that member's sessions. Real schema, every migration applied.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { onRequestPost as logout } from '../functions/api/logout';
import { onRequestPost as revoke } from '../functions/api/admin/member-operations/revoke-sessions';

const ROOT = process.cwd();

function d1Adapter(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const bind = (...args: unknown[]) => ({
        first: async () => (statement.get(...(args as never[])) as unknown) ?? null,
        all: async () => ({ results: statement.all(...(args as never[])) as unknown[] }),
        run: async () => ({ meta: { changes: Number(statement.run(...(args as never[])).changes) } }),
      });
      return { bind, ...bind() };
    },
  };
}

let sqlite: DatabaseSync;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(ROOT, 'migrations', file), 'utf8'));
  }
  sqlite.prepare("INSERT INTO members (email, role) VALUES ('ann@example.com','member'), ('bob@example.com','member'), ('root@example.com','admin')").run();
  for (const [id, email] of [['a1', 'ann@example.com'], ['a2', 'ann@example.com'], ['a3', 'Ann@Example.com'], ['b1', 'bob@example.com'], ['r1', 'root@example.com']]) {
    sqlite.prepare("INSERT INTO member_sessions (id, email, expires_at) VALUES (?, ?, datetime('now','+1 day'))").run(id, email);
  }
});

const env = () => ({ DB: d1Adapter(sqlite) }) as never;
const sessions = () => (sqlite.prepare('SELECT id FROM member_sessions ORDER BY id').all() as { id: string }[]).map((r) => r.id);
const call = (handler: (c: never) => Promise<Response>, url: string, cookie: string | null, body?: unknown) =>
  handler({
    env: env(),
    request: new Request(`https://www.lougehrigfanclub.com${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: `lgfc_session=${cookie}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as never);

describe('POST /api/logout', () => {
  it('without all, ends only this session', async () => {
    expect((await call(logout, '/api/logout', 'a1')).status).toBe(200);
    expect(sessions()).toEqual(['a2', 'a3', 'b1', 'r1']);
  });

  it('with all=true, ends every session of that member (any address casing) and no one else\'s', async () => {
    const res = await call(logout, '/api/logout?all=true', 'a1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(sessions()).toEqual(['b1', 'r1']);
  });

  it('all=true with an unknown or expired session ends nothing else', async () => {
    await call(logout, '/api/logout?all=true', 'nope');
    expect(sessions()).toHaveLength(5);
    sqlite.prepare("UPDATE member_sessions SET expires_at = datetime('now','-1 day') WHERE id = 'b1'").run();
    await call(logout, '/api/logout?all=true', 'b1');
    // an expired session is not recognised, so only that one row (the cookie\'s own) goes
    expect(sessions()).toEqual(['a1', 'a2', 'a3', 'r1']);
  });

  it('an email in the query or body is never used to pick whose sessions end', async () => {
    await call(logout, '/api/logout?all=true&email=bob@example.com', 'a1', { email: 'bob@example.com' });
    expect(sessions()).toEqual(['b1', 'r1']);
  });
});

describe('POST /api/admin/member-operations/revoke-sessions', () => {
  const url = '/api/admin/member-operations/revoke-sessions';

  it('refuses no session (401) and a member session (403) and ends nothing', async () => {
    expect((await call(revoke, url, null, { email: 'ann@example.com' })).status).toBe(401);
    expect((await call(revoke, url, 'b1', { email: 'ann@example.com' })).status).toBe(403);
    expect(sessions()).toHaveLength(5);
  });

  it('an admin ends all of one member\'s sessions and reports how many', async () => {
    const res = await call(revoke, url, 'r1', { email: 'Ann@Example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, email: 'ann@example.com', sessions_revoked: 3 });
    expect(sessions()).toEqual(['b1', 'r1']);
    expect(sqlite.prepare("SELECT role FROM members WHERE email = 'ann@example.com'").get()).toEqual({ role: 'member' });
  });

  it('answers 400 for no email, 404 for an unknown member', async () => {
    expect((await call(revoke, url, 'r1', {})).status).toBe(400);
    expect((await call(revoke, url, 'r1', { email: 'ghost@example.com' })).status).toBe(404);
    expect(sessions()).toHaveLength(5);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('role change guard', () => {
  it('any code that sets members.role also revokes that member\'s sessions', () => {
    const offenders = walk(path.join(ROOT, 'functions'))
      .filter((f) => /UPDATE\s+members\s+SET[^;`"']*\brole\b/i.test(fs.readFileSync(f, 'utf8')))
      .filter((f) => !fs.readFileSync(f, 'utf8').includes('revokeMemberSessions'))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
