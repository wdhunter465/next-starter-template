import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasAdminMention } from '../functions/_lib/discussions';
import { onRequestGet as thread } from '../functions/api/discussions/thread';
import { onRequestGet as list } from '../functions/api/discussions/list';
import { onRequestPost as create } from '../functions/api/discussions/create';
import { onRequestPost as report } from '../functions/api/discussions/report';
import { onRequestGet as flags } from '../functions/api/admin/discussions/flags';
import { onRequestPost as resolveFlag } from '../functions/api/admin/discussions/resolve-flag';

function d1(db: DatabaseSync) {
  const wrap = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => wrap(sql, a),
    first: async () => (db.prepare(sql).get(...(args as any[])) as any) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) as any[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as any[])).changes) } }),
  });
  return { prepare: (sql: string) => wrap(sql) };
}

let db: DatabaseSync;
let env: any;

function member(email: string, first: string, last: string, role = 'member') {
  db.prepare("INSERT OR IGNORE INTO members (email, role, email_verified_at) VALUES (?, ?, datetime('now'))").run(email, role);
  db.prepare('INSERT INTO join_requests (name, email, first_name, last_name) VALUES (?, ?, ?, ?)').run(`${first} ${last}`, email, first, last);
  db.prepare("INSERT INTO member_sessions (id, email, expires_at) VALUES (?, ?, datetime('now', '+1 day'))").run(`sid-${email}`, email);
}

const ctx = (email: string, url: string, body?: unknown) => ({
  env,
  request: new Request(`https://x.test${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: `lgfc_session=sid-${email}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
});
const json = async (res: Response) => (await res.json()) as any;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql')).sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  env = { DB: d1(db) };
  member('bill@example.test', 'Bill', 'Hunter');
  member('amy@example.test', 'Amy', 'Stone');
  member('admin@example.test', 'Ad', 'Min', 'admin');
});

async function topic(email = 'bill@example.test', body = 'Opening day plans') {
  return (await json(await create(ctx(email, '/api/discussions/create', { title: 'A topic', body })))).discussion.id as number;
}

describe('@admin and Report flags (#5553)', () => {
  it('recognizes @admin only as its own word', () => {
    expect(hasAdminMention('Hey @admin, can you help?')).toBe(true);
    expect(hasAdminMention('@Admin please')).toBe(true);
    expect(hasAdminMention('mail me at bill@admin.test')).toBe(false);
    expect(hasAdminMention('@administrator')).toBe(false);
    expect(hasAdminMention('no mention')).toBe(false);
  });

  it('flags a post that mentions @admin and shows it to every member until an admin replies', async () => {
    const id = await topic();
    await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: id, body: '@admin when is the next event?' }));
    let th = await json(await thread(ctx('bill@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.replies[0].question_open).toBe(1);
    expect(th.topic.open_question).toBe(1);
    expect((await json(await list(ctx('amy@example.test', '/api/discussions/list')))).items[0].open_question).toBe(1);

    await create(ctx('admin@example.test', '/api/discussions/create', { parent_id: id, body: 'The next event is June 2.' }));
    th = await json(await thread(ctx('bill@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.replies[0].question_open).toBe(0);
    expect(th.replies[1].is_admin).toBe(1);
    expect(th.topic.open_question).toBe(0);
  });

  it('flags a topic whose message mentions @admin', async () => {
    const id = await topic('bill@example.test', 'Hello @admin, a question for you');
    const th = await json(await thread(ctx('amy@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.topic.question_open).toBe(1);
  });

  it('requires a reason, records the reporter, and shows the report only to the reporter and admins', async () => {
    const id = await topic();
    expect((await report(ctx('amy@example.test', '/api/discussions/report', { id }))).status).toBe(400);
    expect((await report(ctx('amy@example.test', '/api/discussions/report', { id, reason: 'ab' }))).status).toBe(400);
    expect((await json(await report(ctx('amy@example.test', '/api/discussions/report', { id, reason: 'Rude language' })))).ok).toBe(true);

    const mine = await json(await thread(ctx('amy@example.test', `/api/discussions/thread?id=${id}`)));
    expect(mine.topic.reported_by_me).toBe(1);
    const other = await json(await thread(ctx('bill@example.test', `/api/discussions/thread?id=${id}`)));
    expect(other.topic.reported_by_me).toBe(0);
    expect(JSON.stringify(other)).not.toContain('Rude language');

    const admin = await json(await flags(ctx('admin@example.test', '/api/admin/discussions/flags')));
    expect(admin.items).toHaveLength(1);
    expect(admin.items[0]).toMatchObject({ kind: 'report', reason: 'Rude language', flagged_by: 'amy@example.test', flagged_by_name: 'Amy S.' });
    expect((await flags(ctx('amy@example.test', '/api/admin/discussions/flags'))).status).toBe(403);
  });

  it('ignores a repeat report on the same post and limits reports to five an hour', async () => {
    const id = await topic();
    await report(ctx('amy@example.test', '/api/discussions/report', { id, reason: 'First reason' }));
    const again = await json(await report(ctx('amy@example.test', '/api/discussions/report', { id, reason: 'Second reason' })));
    expect(again.already).toBe(true);
    expect(db.prepare("SELECT COUNT(1) AS n FROM discussion_flags WHERE kind = 'report'").get()).toMatchObject({ n: 1 });

    for (let i = 0; i < 4; i++) {
      const t = await topic('bill@example.test', `More posts ${i}`);
      expect((await report(ctx('amy@example.test', '/api/discussions/report', { id: t, reason: 'Reporting this' }))).status).toBe(200);
    }
    const t6 = await topic('bill@example.test', 'One more post');
    expect((await report(ctx('amy@example.test', '/api/discussions/report', { id: t6, reason: 'Too many' }))).status).toBe(429);
  });

  it('lets only an admin resolve a flag, and records who', async () => {
    const id = await topic();
    await report(ctx('amy@example.test', '/api/discussions/report', { id, reason: 'Off topic' }));
    const flagId = (db.prepare('SELECT id FROM discussion_flags').get() as any).id;
    expect((await resolveFlag(ctx('amy@example.test', '/api/admin/discussions/resolve-flag', { id: flagId }))).status).toBe(403);
    expect((await resolveFlag(ctx('admin@example.test', '/api/admin/discussions/resolve-flag', { id: flagId, note: 'Spoke to member' }))).status).toBe(200);
    expect(db.prepare('SELECT status, resolved_by, admin_note FROM discussion_flags WHERE id = ?').get(flagId)).toMatchObject({
      status: 'resolved',
      resolved_by: 'admin@example.test',
      admin_note: 'Spoke to member',
    });
    expect((await resolveFlag(ctx('admin@example.test', '/api/admin/discussions/resolve-flag', { id: flagId }))).status).toBe(404);
  });
});
