// #5124: bulk soft delete of members by id. The script runs against a real-schema in-memory SQLite
// database (every migration applied), and its result is compared with the admin endpoint's.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestPost as adminDelete } from '../functions/api/admin/member-operations/delete';
import { onRequestPost as login } from '../functions/api/login';
import { run } from '../scripts/ops/soft-delete-members.mjs';
import {
  MAX_MEMBERS_PER_RUN,
  buildStatements,
  maskEmail,
  parseArgs,
  parseMemberIds,
  planRun,
} from '../scripts/ops/soft-delete-members-lib.mjs';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

function migrate(sqlite: DatabaseSync) {
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
}

function d1(sqlite: DatabaseSync) {
  return {
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
          return { success: true, meta: { changes: Number(info.changes) } };
        },
      });
      return { bind: bound, ...bound() };
    },
  };
}

const PEOPLE = [
  { email: 'test.one@example.com', name: 'Test One' },
  { email: 'Test.Two@Example.com', name: 'Test Two' },
  { email: 'real.person@example.org', name: 'Real Person' },
];

function seed() {
  const sqlite = new DatabaseSync(':memory:');
  migrate(sqlite);
  for (const person of PEOPLE) {
    sqlite.prepare(`INSERT INTO members (email, role, email_verified_at) VALUES (?, 'member', datetime('now'))`).run(person.email.toLowerCase());
    sqlite.prepare(`INSERT INTO join_requests (name, email, first_name, last_name) VALUES (?, ?, 'F', 'L')`).run(person.name, person.email.toLowerCase());
    sqlite.prepare(`INSERT INTO member_sessions (id, email, expires_at) VALUES (?, ?, datetime('now','+1 day'))`).run(`sess-${person.email.toLowerCase()}`, person.email.toLowerCase());
  }
  seedAdminSession(sqlite);
  const id = (email: string) => (sqlite.prepare(`SELECT id FROM members WHERE lower(email) = lower(?)`).get(email) as { id: number }).id;
  return { sqlite, id };
}

const baseOptions = { issue: '5124', reason: 'Test accounts (Product Authority 2026-11-07)', restore: false, apply: true, database: 'lgfc_lite', target: 'remote' };

function snapshot(sqlite: DatabaseSync) {
  return {
    members: sqlite.prepare(`SELECT email, role, deleted_at IS NOT NULL AS gone, deletion_reason IS NOT NULL AS has_reason FROM members ORDER BY email`).all(),
    joins: sqlite.prepare(`SELECT lower(email) AS email, deleted_at IS NOT NULL AS gone FROM join_requests ORDER BY email`).all(),
    sessions: sqlite.prepare(`SELECT email FROM member_sessions WHERE id LIKE 'sess-%' ORDER BY email`).all(),
  };
}

describe('library (#5124)', () => {
  it('masks an address to its first letter and domain', () => {
    expect(maskEmail('beatsworkingforaliving@gmail.com')).toBe('b***@gmail.com');
    expect(maskEmail('nonsense')).toBe('***');
    expect(maskEmail(null)).toBe('***');
  });

  it('parses ids, dropping repeats, and refuses anything else', () => {
    expect(parseMemberIds('4, 5,6 6')).toEqual([4, 5, 6]);
    for (const bad of ['', '4,a', '4;5', '-1', '0', '1.5', "1 OR 1=1", '99999999999999999999']) expect(() => parseMemberIds(bad), bad).toThrow();
    expect(() => parseMemberIds(Array.from({ length: MAX_MEMBERS_PER_RUN + 1 }, (_, i) => i + 1).join(','))).toThrow(/at most 50/);
  });

  it('requires an issue, a reason of some length, ids and the expected count', () => {
    const ok = ['--ids', '1,2', '--issue', '#5124', '--reason', 'Test accounts removed', '--expect', '2'];
    expect(parseArgs(ok)).toMatchObject({ ids: [1, 2], issue: '5124', expect: 2, apply: false, restore: false });
    expect(() => parseArgs(['--ids', '1', '--issue', 'x', '--reason', 'Test accounts removed', '--expect', '1'])).toThrow(/issue/);
    expect(() => parseArgs(['--ids', '1', '--issue', '1', '--reason', 'short', '--expect', '1'])).toThrow(/reason/);
    expect(() => parseArgs(['--ids', '1', '--issue', '1', '--reason', 'Test accounts removed'])).toThrow(/expect/);
    expect(() => parseArgs([...ok, '--bogus'])).toThrow(/unknown/);
  });

  it('plans only members that are not already removed, and stops on a mismatch', () => {
    const rows = [
      { id: 1, email: 'a@x.com', role: 'member', deleted_at: null },
      { id: 2, email: 'b@x.com', role: 'member', deleted_at: '2026-11-01' },
    ];
    const plan = planRun(rows, [1, 2], { restore: false, expect: 1 });
    expect(plan.targets.map((row: { id: number }) => row.id)).toEqual([1]);
    expect(plan.skipped).toEqual([{ id: 2, why: 'is already soft-deleted' }]);
    expect(() => planRun(rows, [1, 2], { restore: false, expect: 2 })).toThrow(/expected to change 2/);
    expect(planRun(rows, [1, 2], { restore: true, expect: 1 }).targets[0].id).toBe(2);
  });

  it('builds the same three writes as the admin endpoint', () => {
    const statements = buildStatements('Mixed@Case.com', { now: 'T', reason: 'why', deletedBy: 'who', restore: false });
    expect(statements.map((s: { sql: string }) => s.sql.split(' ').slice(0, 3).join(' '))).toEqual(['UPDATE members SET', 'UPDATE join_requests SET', 'DELETE FROM member_sessions']);
    expect(statements[0].params).toEqual(['T', 'why', 'who', 'T', 'mixed@case.com']);
  });
});

describe('run against a real-schema database (#5124)', () => {
  it('a dry run lists the members and writes nothing', async () => {
    const { sqlite, id } = seed();
    const before = snapshot(sqlite);
    const lines: string[] = [];
    const ids = [id(PEOPLE[0].email), id(PEOPLE[1].email)];
    const result = await run({ ...baseOptions, apply: false, ids, expect: 2 }, d1(sqlite), (line: string) => lines.push(line));
    expect(result.changed).toBe(0);
    expect(snapshot(sqlite)).toEqual(before);
    expect(lines.join('\n')).toContain('dry run, nothing will be written');
    expect(lines.join('\n')).toContain('Dry run.');
  });

  it('apply matches what the admin endpoint does to the same members', async () => {
    const viaScript = seed();
    const viaAdmin = seed();
    const targets = [PEOPLE[0].email, PEOPLE[1].email];

    await run({ ...baseOptions, ids: targets.map((email) => viaScript.id(email)), expect: 2 }, d1(viaScript.sqlite), () => undefined);
    for (const email of targets) {
      const res = await adminDelete({
        request: new Request('https://www.lougehrigfanclub.com/api/admin/member-operations/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: ADMIN_SESSION_COOKIE },
          body: JSON.stringify({ email, deletion_reason: 'Test account', deleted_by: 'admin' }),
        }),
        env: { DB: d1(viaAdmin.sqlite) },
      } as any);
      expect(res.status).toBe(200);
    }

    const a = snapshot(viaScript.sqlite);
    const b = snapshot(viaAdmin.sqlite);
    expect(a).toEqual(b);
    // The two that stay are untouched: still a member, a join request and a session.
    expect(a.members.filter((row: any) => !row.gone).map((row: any) => row.email)).toEqual(expect.arrayContaining([PEOPLE[2].email]));
    expect(a.sessions).toEqual([{ email: PEOPLE[2].email }]);
  });

  it('records who and why, keeps every row, and blocks sign-in for the removed member only', async () => {
    const { sqlite, id } = seed();
    const count = (table: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    const [membersBefore, joinsBefore] = [count('members'), count('join_requests')];
    await run({ ...baseOptions, ids: [id(PEOPLE[0].email)], expect: 1 }, d1(sqlite), () => undefined);

    // Soft delete: no row is removed from either table.
    expect(count('members')).toBe(membersBefore);
    expect(count('join_requests')).toBe(joinsBefore);
    expect(sqlite.prepare(`SELECT deleted_by, deletion_reason FROM members WHERE lower(email)=?`).get(PEOPLE[0].email)).toEqual({
      deleted_by: 'ops-workflow #5124',
      deletion_reason: 'Test accounts (Product Authority 2026-11-07)',
    });

    const attempt = (email: string) =>
      login({
        env: { DB: d1(sqlite) },
        request: new Request('https://www.lougehrigfanclub.com/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' }, body: JSON.stringify({ email }) }),
      } as any);
    expect((await attempt(PEOPLE[0].email)).status).toBe(404);
    expect((await attempt(PEOPLE[2].email)).status).toBe(200);
  });

  it('restore undoes a removal', async () => {
    const { sqlite, id } = seed();
    const ids = [id(PEOPLE[0].email)];
    await run({ ...baseOptions, ids, expect: 1 }, d1(sqlite), () => undefined);
    await run({ ...baseOptions, ids, expect: 1, restore: true }, d1(sqlite), () => undefined);
    expect(sqlite.prepare(`SELECT deleted_at, deletion_reason, deleted_by FROM members WHERE lower(email)=?`).get(PEOPLE[0].email)).toEqual({ deleted_at: null, deletion_reason: null, deleted_by: null });
    expect(sqlite.prepare(`SELECT deleted_at FROM join_requests WHERE lower(email)=?`).get(PEOPLE[0].email)).toEqual({ deleted_at: null });
  });

  it('refuses an admin, an unknown id and a count mismatch, writing nothing', async () => {
    const { sqlite, id } = seed();
    const before = snapshot(sqlite);
    const adminId = (sqlite.prepare(`SELECT id FROM members WHERE role='admin' LIMIT 1`).get() as { id: number }).id;
    const test = id(PEOPLE[0].email);

    await expect(run({ ...baseOptions, ids: [test, adminId], expect: 2 }, d1(sqlite), () => undefined)).rejects.toThrow(/admin/);
    await expect(run({ ...baseOptions, ids: [test, 999999], expect: 2 }, d1(sqlite), () => undefined)).rejects.toThrow(/no member with id 999999/);
    await expect(run({ ...baseOptions, ids: [test], expect: 5 }, d1(sqlite), () => undefined)).rejects.toThrow(/expected to change 5/);
    expect(snapshot(sqlite)).toEqual(before);
  });

  it('never prints a full email address, in a dry run or an apply', async () => {
    const { sqlite, id } = seed();
    const lines: string[] = [];
    const ids = PEOPLE.map((p) => id(p.email));
    await run({ ...baseOptions, apply: false, ids, expect: 3 }, d1(sqlite), (line: string) => lines.push(line));
    await run({ ...baseOptions, ids, expect: 3 }, d1(sqlite), (line: string) => lines.push(line));
    const text = lines.join('\n');
    for (const person of PEOPLE) {
      expect(text.toLowerCase()).not.toContain(person.email.toLowerCase());
      expect(text.toLowerCase()).not.toContain(person.email.split('@')[0].toLowerCase());
    }
    expect(text).toContain('t***@example.com');
  });

  it('is safe to run twice: a member already removed is skipped, not changed again', async () => {
    const { sqlite, id } = seed();
    const ids = [id(PEOPLE[0].email), id(PEOPLE[1].email)];
    await run({ ...baseOptions, ids: [ids[0]], expect: 1 }, d1(sqlite), () => undefined);
    const stamp = sqlite.prepare(`SELECT deleted_at FROM members WHERE id=?`).get(ids[0]);
    const lines: string[] = [];
    const result = await run({ ...baseOptions, ids, expect: 1 }, d1(sqlite), (line: string) => lines.push(line));
    expect(result.changed).toBe(1);
    expect(lines.join('\n')).toContain('already soft-deleted');
    expect(sqlite.prepare(`SELECT deleted_at FROM members WHERE id=?`).get(ids[0])).toEqual(stamp);
  });
  it('promotes a member to admin, and removes an admin only when another stays', async () => {
    const { sqlite, id } = seed();
    const log = () => undefined;
    const memberId = id(PEOPLE[2].email);
    const admins = sqlite.prepare(`SELECT id FROM members WHERE role='admin' ORDER BY id`).all() as Array<{ id: number }>;
    expect(admins.length).toBeGreaterThanOrEqual(2);

    await run({ ...baseOptions, ids: [memberId], expect: 1, promote: true }, d1(sqlite), log);
    expect(sqlite.prepare(`SELECT role FROM members WHERE id = ?`).get(memberId)).toEqual({ role: 'admin' });

    // An admin is refused without allow-admin, and nothing changes.
    await expect(run({ ...baseOptions, ids: [admins[1].id], expect: 1 }, d1(sqlite), log)).rejects.toThrow(/allow-admin/);
    // With it, the removal works while another active admin remains.
    await run({ ...baseOptions, ids: [admins[1].id], expect: 1, allowAdmin: true }, d1(sqlite), log);
    expect(sqlite.prepare(`SELECT deleted_at IS NOT NULL AS gone FROM members WHERE id = ?`).get(admins[1].id)).toEqual({ gone: 1 });

    // Never the last active admin.
    const remaining = (sqlite.prepare(`SELECT id FROM members WHERE role='admin' AND deleted_at IS NULL`).all() as Array<{ id: number }>).map((r) => r.id);
    await expect(
      run({ ...baseOptions, ids: remaining, expect: remaining.length, allowAdmin: true }, d1(sqlite), log),
    ).rejects.toThrow(/no active admin/);
    expect(() => planRun([{ id: 1, role: 'member', deleted_at: '2026-01-01' }], [1], { promote: true, expect: 1 })).toThrow(/soft-deleted/);
    expect(() => parseArgs(['--ids', '1', '--issue', '1', '--reason', 'ten chars ok', '--expect', '1', '--promote', '--restore'])).toThrow(/cannot be combined/);
  });
});
