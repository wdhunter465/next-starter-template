// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { onRequestPost } from '../functions/api/join';

// #4466 (gap rows 25 and 81): duplicate, malformed and hostile requests to POST /api/join,
// run against the REAL schema.
//
// The existing join tests answer D1 with hand-written doubles, so the duplicate guard
// (INSERT ... WHERE NOT EXISTS on lower(email)), the members side effect and the handling of
// injection strings were never executed against SQL. This builds an in-memory SQLite database
// from the repository's own migrations. Email is disabled (MAILCHANNELS_ENABLED unset), so no
// message is sent.

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

type JoinBody = { ok: boolean; status?: string; error?: string };

async function post(body: BodyInit | null, contentType: string | null = 'application/json') {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  const response = await onRequestPost({
    env: { DB: d1Adapter(sqlite) } as never,
    request: new Request('https://www.lougehrigfanclub.com/api/join', { method: 'POST', headers, body }),
  });
  return { status: response.status, body: (await response.json()) as JoinBody };
}

const postJson = (payload: unknown) => post(JSON.stringify(payload));
const total = (table: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
// Migrations seed some rows, so assertions count what a request added, not absolute totals.
let baseline: Record<string, number>;
const count = (table: string) => total(table) - baseline[table];
const valid = { first_name: 'Lou', last_name: 'Gehrig', email: 'Lou@Example.com' };

beforeEach(() => {
  sqlite = freshDb();
  baseline = { join_requests: total('join_requests'), members: total('members') };
});

describe('POST /api/join duplicate requests against the real schema (row 25)', () => {
  it('joins once, lower-cases the email, and creates the member record', async () => {
    const { status, body } = await postJson(valid);

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, status: 'joined' });
    expect(sqlite.prepare("SELECT email FROM join_requests WHERE lower(email) = 'lou@example.com'").all()).toEqual([{ email: 'lou@example.com' }]);
    expect(sqlite.prepare("SELECT email, role FROM members WHERE email = 'lou@example.com'").all()).toEqual([{ email: 'lou@example.com', role: 'member' }]);
  });

  it('answers a repeat with 409 and keeps exactly one row, whatever the email case or padding', async () => {
    await postJson(valid);

    for (const email of ['lou@example.com', 'LOU@EXAMPLE.COM', '  Lou@Example.com  ']) {
      const { status, body } = await postJson({ ...valid, email });
      expect(status, email).toBe(409);
      expect(body).toMatchObject({ ok: false, status: 'already_joined' });
    }

    expect(count('join_requests')).toBe(1);
    expect(count('members')).toBe(1);
  });

  it('does not let a duplicate change the stored name or role', async () => {
    await postJson(valid);
    sqlite.prepare("UPDATE members SET role = 'admin' WHERE email = 'lou@example.com'").run();

    await postJson({ ...valid, first_name: 'Someone', last_name: 'Else' });

    expect(sqlite.prepare("SELECT first_name, last_name FROM join_requests WHERE email = 'lou@example.com'").get()).toMatchObject({
      first_name: 'Lou',
      last_name: 'Gehrig',
    });
    expect(sqlite.prepare("SELECT role FROM members WHERE email = 'lou@example.com'").get()).toEqual({ role: 'admin' });
  });

  it('accepts only one of many simultaneous identical requests', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => postJson(valid)));

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(count('join_requests')).toBe(1);
  });
});

describe('POST /api/join malformed requests write nothing (row 25)', () => {
  it.each([
    ['empty object', {}],
    ['missing email', { first_name: 'Lou', last_name: 'Gehrig' }],
    ['blank email', { ...valid, email: '   ' }],
    ['null email', { ...valid, email: null }],
    ['missing last name', { first_name: 'Lou', email: 'a@example.com' }],
    ['blank names', { first_name: ' ', last_name: ' ', email: 'a@example.com' }],
  ])('rejects %s with 400', async (_label, payload) => {
    const { status, body } = await postJson(payload);

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(count('join_requests')).toBe(0);
    expect(count('members')).toBe(0);
  });

  it.each([
    ['broken JSON', '{"first_name": "Lou", '],
    ['empty body', ''],
    ['plain text', 'hello'],
    ['a JSON array', '[1, 2, 3]'],
    ['a JSON string', '"just text"'],
  ])('writes nothing for %s', async (_label, raw) => {
    const { status } = await post(raw);

    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(600);
    expect(count('join_requests')).toBe(0);
    expect(count('members')).toBe(0);
  });

  it('reads a form-encoded body the same as JSON', async () => {
    const form = new URLSearchParams({ first_name: 'Lou', last_name: 'Gehrig', email: 'form@example.com' });
    const { status } = await post(form.toString(), 'application/x-www-form-urlencoded');

    expect(status).toBe(200);
    expect(sqlite.prepare("SELECT email FROM join_requests WHERE email = 'form@example.com'").all()).toEqual([{ email: 'form@example.com' }]);
  });
});

describe('POST /api/join hostile input stays inert (row 81)', () => {
  const hostile = [
    "Robert'); DROP TABLE join_requests;--",
    "' OR '1'='1",
    "x'); DELETE FROM members;--",
    '<script>alert(1)</script>',
    '𝕷𝖔𝖚 ‮rtl-override',
    'A'.repeat(5000),
  ];

  it.each(hostile)('stores %s as plain text and leaves the schema and other rows intact', async (value) => {
    await postJson({ first_name: 'Keep', last_name: 'Me', email: 'keep@example.com' });

    const { status } = await postJson({
      first_name: value,
      last_name: value,
      screen_name: value,
      email: 'hostile@example.com',
    });

    expect(status).toBe(200);
    expect(count('join_requests')).toBe(2);
    expect(count('members')).toBe(2);
    expect(sqlite.prepare("SELECT first_name FROM join_requests WHERE email = 'hostile@example.com'").get()).toEqual({
      first_name: value.trim(),
    });
    expect(sqlite.prepare("SELECT email FROM members WHERE email = 'keep@example.com'").get()).toBeTruthy();
  });

  it('does not treat an injection string in the email as SQL', async () => {
    await postJson({ ...valid, email: 'victim@example.com' });

    const { status } = await postJson({ ...valid, email: "x' OR 1=1 --" });

    expect(count('join_requests')).toBeGreaterThanOrEqual(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM join_requests WHERE email = 'victim@example.com'").get()).toEqual({ n: 1 });
    // Whatever the response, the lookup must not have matched the other member's row as a duplicate.
    expect([200, 400]).toContain(status);
  });

  it('ignores role and other privileged fields in the body', async () => {
    const { status } = await postJson({ ...valid, role: 'admin', is_admin: true, id: 1 });

    expect(status).toBe(200);
    expect(sqlite.prepare("SELECT role FROM members WHERE email = 'lou@example.com'").all()).toEqual([{ role: 'member' }]);
  });

  it('fails closed with 503 when the database binding is missing', async () => {
    const response = await onRequestPost({
      env: {} as never,
      request: new Request('https://www.lougehrigfanclub.com/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }),
    });

    expect(response.status).toBe(503);
  });
});
