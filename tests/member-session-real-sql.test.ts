// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { requireAdminMember, requireMember, revokeMemberSessions } from '../functions/_lib/session';

// #4466 (gap rows 22, 23, 24, 82): stale, invalid, tampered and restored member sessions,
// and stale privilege, run against the REAL schema.
//
// The existing member and admin tests answer the session lookup with hand-written doubles,
// so the SQL in functions/_lib/session.ts (expiry, soft-delete, case-insensitive join) was
// never executed by any test. This builds an in-memory SQLite database from the repository's
// own migrations and runs requireMember()/requireAdminMember() against it. D1 is SQLite, and
// every migration applies, so the schema here cannot drift from the real one.

const migrationsDir = path.join(process.cwd(), 'migrations');

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

function freshDb() {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

const FUTURE = "datetime('now', '+1 day')";
const PAST = "datetime('now', '-1 day')";

let sqlite: DatabaseSync;

function addMember(email: string, role = 'member') {
  sqlite.prepare('INSERT INTO members (email, role) VALUES (?, ?)').run(email, role);
}
function addSession(id: string, email: string, expires: string) {
  sqlite.exec(`INSERT INTO member_sessions (id, email, expires_at) VALUES ('${id}', '${email}', ${expires})`);
}
function ctx(cookie: string | null) {
  const headers: Record<string, string> = {};
  if (cookie !== null) headers.Cookie = cookie;
  return {
    env: { DB: d1Adapter(sqlite) },
    request: new Request('https://www.lougehrigfanclub.com/api/member/probe', { headers }),
  };
}
const cookieFor = (id: string) => `lgfc_session=${encodeURIComponent(id)}`;

beforeEach(() => {
  sqlite = freshDb();
});

describe('requireMember against the real schema (#4466)', () => {
  it('accepts a valid, unexpired session and normalizes the email', async () => {
    addMember('Fan@Example.com');
    addSession('s-valid', 'FAN@example.com', FUTURE);

    const result = await requireMember(ctx(cookieFor('s-valid')));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe('fan@example.com');
  });

  it('denies a request with no session cookie', async () => {
    addMember('fan@example.com');
    addSession('s-valid', 'fan@example.com', FUTURE);

    const result = await requireMember(ctx(null));

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('denies an unknown or forged session id', async () => {
    addMember('fan@example.com');
    addSession('s-valid', 'fan@example.com', FUTURE);

    for (const forged of ['s-valid-but-wrong', 'S-VALID', ' ', 's-valid\u0000', 'x'.repeat(500)]) {
      const result = await requireMember(ctx(cookieFor(forged)));
      expect(result, `forged id ${JSON.stringify(forged.slice(0, 20))}`).toMatchObject({ ok: false, status: 401 });
    }
  });

  it('treats an injection attempt in the session id as an ordinary unknown id', async () => {
    addMember('fan@example.com');
    addSession('s-valid', 'fan@example.com', FUTURE);
    const before = (sqlite.prepare('SELECT COUNT(*) AS n FROM member_sessions').get() as { n: number }).n;

    for (const attack of ["' OR '1'='1", "x'; DELETE FROM member_sessions; --", "' UNION SELECT 'fan@example.com' --"]) {
      const result = await requireMember(ctx(cookieFor(attack)));
      expect(result, attack).toMatchObject({ ok: false, status: 401 });
    }

    const after = (sqlite.prepare('SELECT COUNT(*) AS n FROM member_sessions').get() as { n: number }).n;
    expect(after).toBe(before);
  });

  it('denies an expired session', async () => {
    addMember('fan@example.com');
    addSession('s-expired', 'fan@example.com', PAST);

    expect(await requireMember(ctx(cookieFor('s-expired')))).toMatchObject({ ok: false, status: 401 });
  });

  it('denies a session whose member was soft-deleted, and allows it again once restored', async () => {
    addMember('fan@example.com');
    addSession('s-valid', 'fan@example.com', FUTURE);
    expect((await requireMember(ctx(cookieFor('s-valid')))).ok).toBe(true);

    sqlite.exec("UPDATE members SET deleted_at = datetime('now') WHERE email = 'fan@example.com'");
    expect(await requireMember(ctx(cookieFor('s-valid')))).toMatchObject({ ok: false, status: 401 });

    sqlite.exec("UPDATE members SET deleted_at = NULL WHERE email = 'fan@example.com'");
    expect((await requireMember(ctx(cookieFor('s-valid')))).ok).toBe(true);
  });

  it('denies a session whose member row no longer exists', async () => {
    addSession('s-orphan', 'ghost@example.com', FUTURE);

    expect(await requireMember(ctx(cookieFor('s-orphan')))).toMatchObject({ ok: false, status: 401 });
  });

  it('denies every session of a member after revokeMemberSessions()', async () => {
    addMember('fan@example.com');
    addSession('s-one', 'fan@example.com', FUTURE);
    addSession('s-two', 'Fan@Example.com', FUTURE);
    addMember('other@example.com');
    addSession('s-other', 'other@example.com', FUTURE);

    await revokeMemberSessions(d1Adapter(sqlite), 'FAN@example.com');

    expect(await requireMember(ctx(cookieFor('s-one')))).toMatchObject({ ok: false, status: 401 });
    expect(await requireMember(ctx(cookieFor('s-two')))).toMatchObject({ ok: false, status: 401 });
    expect((await requireMember(ctx(cookieFor('s-other')))).ok).toBe(true);
  });

  it('fails closed with 503 when the database binding is missing', async () => {
    const request = new Request('https://www.lougehrigfanclub.com/api/member/probe', {
      headers: { Cookie: cookieFor('s-valid') },
    });

    expect(await requireMember({ env: {}, request })).toMatchObject({ ok: false, status: 503 });
  });
});

describe('requireAdminMember and stale privilege against the real schema (#4466)', () => {
  it('allows an admin, denies a member with 403, and denies an anonymous caller with 401', async () => {
    addMember('boss@example.com', 'admin');
    addSession('s-admin', 'boss@example.com', FUTURE);
    addMember('fan@example.com', 'member');
    addSession('s-member', 'fan@example.com', FUTURE);

    expect((await requireAdminMember(ctx(cookieFor('s-admin')))).ok).toBe(true);
    expect(await requireAdminMember(ctx(cookieFor('s-member')))).toMatchObject({ ok: false, status: 403 });
    expect(await requireAdminMember(ctx(null))).toMatchObject({ ok: false, status: 401 });
  });

  it('applies a demotion on the very next request, with the same session', async () => {
    addMember('boss@example.com', 'admin');
    addSession('s-admin', 'boss@example.com', FUTURE);
    expect((await requireAdminMember(ctx(cookieFor('s-admin')))).ok).toBe(true);

    sqlite.exec("UPDATE members SET role = 'member' WHERE email = 'boss@example.com'");

    expect(await requireAdminMember(ctx(cookieFor('s-admin')))).toMatchObject({ ok: false, status: 403 });
  });

  it('denies an admin whose session has expired or whose account is soft-deleted', async () => {
    addMember('boss@example.com', 'admin');
    addSession('s-old', 'boss@example.com', PAST);
    expect(await requireAdminMember(ctx(cookieFor('s-old')))).toMatchObject({ ok: false, status: 401 });

    addSession('s-live', 'boss@example.com', FUTURE);
    expect((await requireAdminMember(ctx(cookieFor('s-live')))).ok).toBe(true);
    sqlite.exec("UPDATE members SET deleted_at = datetime('now') WHERE email = 'boss@example.com'");
    expect(await requireAdminMember(ctx(cookieFor('s-live')))).toMatchObject({ ok: false, status: 401 });
  });
});
