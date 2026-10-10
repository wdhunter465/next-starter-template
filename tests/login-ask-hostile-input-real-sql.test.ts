// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { onRequestPost as askPost } from '../functions/api/ask';
import { onRequestPost as loginPost } from '../functions/api/login';
import { requireAdminMember, requireMember } from '../functions/_lib/session';

// #4466 (gap rows 25, 80, 81): duplicate, malformed and hostile requests, and auth-bypass
// attempts, against POST /api/login and POST /api/ask on the REAL schema.
//
// The existing login and ask tests answer D1 with hand-written doubles, so the lookup SQL, the
// per-IP failure limit and the inbox insert were never executed. This builds an in-memory
// SQLite database from the repository's own migrations. Email is disabled, so none is sent.

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

let sqlite: DatabaseSync;
let baseline: Record<string, number>;

const total = (table: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const added = (table: string) => total(table) - baseline[table];
const TABLES = ['join_requests', 'members', 'member_sessions', 'login_attempts', 'ask_inbox'];

beforeEach(() => {
  sqlite = freshDb();
  baseline = Object.fromEntries(TABLES.map((t) => [t, total(t)]));
});

function join(email: string) {
  sqlite.prepare("INSERT INTO join_requests (name, email, first_name, last_name) VALUES ('T', ?, 'T', 'T')").run(email);
}

async function login(payload: unknown, headers: Record<string, string> = { 'CF-Connecting-IP': '203.0.113.7' }) {
  const response = await loginPost({
    env: { DB: d1Adapter(sqlite) } as never,
    request: new Request('https://www.lougehrigfanclub.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  });
  return { response, status: response.status, body: (await response.json()) as { ok: boolean; error?: string } };
}

describe('POST /api/login against the real schema (rows 80, 81)', () => {
  it('signs in a joined member, mixed-case email, and the cookie then passes requireMember', async () => {
    join('fan@example.com');

    const { response, status } = await login({ email: '  FAN@Example.com ' });

    expect(status).toBe(200);
    const cookie = response.headers.get('Set-Cookie')!.split(';')[0];
    const member = await requireMember({
      env: { DB: d1Adapter(sqlite) },
      request: new Request('https://www.lougehrigfanclub.com/api/member/probe', { headers: { Cookie: cookie } }),
    });
    expect(member).toMatchObject({ ok: true, email: 'fan@example.com' });
  });

  it('never grants admin through login: the session is a member session', async () => {
    join('fan@example.com');
    const { response } = await login({ email: 'fan@example.com' });
    const cookie = response.headers.get('Set-Cookie')!.split(';')[0];

    const admin = await requireAdminMember({
      env: { DB: d1Adapter(sqlite) },
      request: new Request('https://www.lougehrigfanclub.com/api/admin/stats', { headers: { Cookie: cookie } }),
    });

    expect(admin).toMatchObject({ ok: false });
    expect((admin as { status: number }).status).toBe(403);
  });

  it('refuses an email that never joined, with no session and the failure logged', async () => {
    const { status } = await login({ email: 'stranger@example.com' });

    expect(status).toBe(404);
    expect(added('member_sessions')).toBe(0);
    expect(added('login_attempts')).toBe(1);
  });

  it('refuses a soft-deleted member, and signs them in again once restored', async () => {
    join('gone@example.com');
    sqlite.prepare("INSERT OR IGNORE INTO members (email, role) VALUES ('gone@example.com', 'member')").run();
    sqlite.prepare("UPDATE members SET deleted_at = datetime('now') WHERE email = 'gone@example.com'").run();

    expect((await login({ email: 'gone@example.com' })).status).toBe(404);
    expect(added('member_sessions')).toBe(0);

    sqlite.prepare("UPDATE members SET deleted_at = NULL WHERE email = 'gone@example.com'").run();
    expect((await login({ email: 'gone@example.com' }, { 'CF-Connecting-IP': '203.0.113.99' })).status).toBe(200);
  });

  it.each([
    ['injection in the email', "x' OR '1'='1@example.com"],
    ['union select', "a@b.c' UNION SELECT 1 --@example.com"],
    ['wildcard', '%@%'],
    ['underscore wildcard', '_____@example.com'],
  ])('does not treat %s as a match for another member', async (_label, email) => {
    join('victim@example.com');

    const { status } = await login({ email });

    expect(status).toBe(404);
    expect(added('member_sessions')).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM join_requests WHERE email = 'victim@example.com'").get()).toEqual({ n: 1 });
  });

  it.each([
    ['empty object', {}],
    ['null email', { email: null }],
    ['no at sign', { email: 'not-an-email' }],
    ['blank', { email: '   ' }],
    ['broken JSON', '{"email": '],
    ['array body', '[1,2]'],
  ])('rejects %s without creating a session', async (_label, payload) => {
    const { status } = await login(payload as never);

    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(600);
    expect(added('member_sessions')).toBe(0);
  });

  it('locks an address out after three failures, even for a valid member', async () => {
    join('fan@example.com');
    for (let i = 0; i < 3; i += 1) expect((await login({ email: `nobody${i}@example.com` })).status).toBe(404);

    const locked = await login({ email: 'fan@example.com' });

    expect(locked.status).toBe(429);
    expect(added('member_sessions')).toBe(0);
  });

  it('does not let failures from one address lock out another', async () => {
    join('fan@example.com');
    for (let i = 0; i < 3; i += 1) await login({ email: `nobody${i}@example.com` });

    const other = await login({ email: 'fan@example.com' }, { 'CF-Connecting-IP': '198.51.100.20' });

    expect(other.status).toBe(200);
  });

  it('counts failures only from the last hour', async () => {
    join('fan@example.com');
    for (let i = 0; i < 3; i += 1) await login({ email: `nobody${i}@example.com` });
    sqlite.exec("UPDATE login_attempts SET created_at = datetime('now', '-2 hours')");

    expect((await login({ email: 'fan@example.com' })).status).toBe(200);
  });
});

async function ask(payload: unknown) {
  const response = await askPost({
    env: { DB: d1Adapter(sqlite) } as never,
    request: new Request('https://www.lougehrigfanclub.com/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  });
  return { status: response.status, body: (await response.json()) as { ok: boolean } };
}

const question = {
  first_name: 'Lou',
  last_name: 'Gehrig',
  email: 'Asker@Example.com',
  question: 'When was the first Lou Gehrig Day?',
};

describe('POST /api/ask against the real schema (rows 25, 81)', () => {
  it('stores the question once as open, joins the visitor, and lower-cases the email', async () => {
    const { status } = await ask(question);

    expect(status).toBe(200);
    expect(sqlite.prepare("SELECT email, status FROM ask_inbox WHERE email = 'asker@example.com'").all()).toEqual([
      { email: 'asker@example.com', status: 'open' },
    ]);
    expect(added('join_requests')).toBe(1);
    expect(added('members')).toBe(1);
  });

  it('keeps every question from a repeat visitor but never joins them twice', async () => {
    await ask(question);
    await ask({ ...question, email: 'ASKER@example.com', question: 'A second, different question here.' });

    expect(added('ask_inbox')).toBe(2);
    expect(added('join_requests')).toBe(1);
    expect(added('members')).toBe(1);
  });

  it.each([
    ['empty object', {}],
    ['missing last name', { ...question, last_name: ' ' }],
    ['invalid email', { ...question, email: 'nope' }],
    ['email with spaces', { ...question, email: 'a b@example.com' }],
    ['email over 254 characters', { ...question, email: `${'a'.repeat(250)}@example.com` }],
    ['question under 10 characters', { ...question, question: 'short' }],
    ['broken JSON', '{"first_name": '],
  ])('rejects %s with 400 and stores nothing', async (_label, payload) => {
    const { status } = await ask(payload as never);

    expect(status).toBe(400);
    expect(added('ask_inbox')).toBe(0);
    expect(added('join_requests')).toBe(0);
  });

  it.each([
    "Robert'); DROP TABLE ask_inbox;--",
    '<script>alert(document.cookie)</script>',
    '𝕷𝖔𝖚 ‮rtl-override question text',
    'Q'.repeat(20000),
  ])('stores %s as inert text', async (text) => {
    const { status } = await ask({ ...question, question: text, screen_name: text.slice(0, 50) });

    expect(status).toBe(200);
    expect(sqlite.prepare('SELECT question FROM ask_inbox WHERE email = ?').get('asker@example.com')).toEqual({ question: text.trim() });
    expect(total('ask_inbox')).toBe(baseline.ask_inbox + 1);
  });

  it('ignores a status or role supplied in the body', async () => {
    await ask({ ...question, status: 'answered', role: 'admin' });

    expect(sqlite.prepare("SELECT status FROM ask_inbox WHERE email = 'asker@example.com'").get()).toEqual({ status: 'open' });
    expect(sqlite.prepare("SELECT role FROM members WHERE email = 'asker@example.com'").get()).toEqual({ role: 'member' });
  });
});
