import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestGet as list } from '../functions/api/discussions/list';
import { onRequestGet as thread } from '../functions/api/discussions/thread';
import { onRequestPost as create } from '../functions/api/discussions/create';
import { onRequestPost as settings } from '../functions/api/discussions/settings';
import { onRequestPost as hide } from '../functions/api/admin/discussions/hide';

// A D1-shaped wrapper over node:sqlite, with every migration applied.
function d1(db: DatabaseSync) {
  const wrap = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => wrap(sql, a),
    first: async () => (db.prepare(sql).get(...(args as any[])) as any) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) as any[] }),
    run: async () => {
      const r = db.prepare(sql).run(...(args as any[]));
      return { meta: { changes: Number(r.changes) } };
    },
  });
  return { prepare: (sql: string) => wrap(sql) };
}

let db: DatabaseSync;
let env: any;

function migrate() {
  const conn = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql')).sort()) conn.exec(readFileSync(`migrations/${f}`, 'utf8'));
  return conn;
}

function member(email: string, first: string, last: string, screen: string | null = null, role = 'member') {
  db.prepare("INSERT OR IGNORE INTO members (email, role, email_verified_at) VALUES (?, ?, datetime('now'))").run(email, role);
  db.prepare('INSERT INTO join_requests (name, email, first_name, last_name, screen_name) VALUES (?, ?, ?, ?, ?)').run(`${first} ${last}`, email, first, last, screen);
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

beforeEach(() => {
  db = migrate();
  env = { DB: d1(db) };
  member('bill@example.test', 'Bill', 'Hunter');
  member('amy@example.test', 'Amy', 'Stone', 'Iron Amy');
  member('admin@example.test', 'Ad', 'Min', null, 'admin');
});

const json = async (res: Response) => (await res.json()) as any;

describe('threaded Member Chat (#5550)', () => {
  it('shows replies under their topic with display names and never an email', async () => {
    const t = await json(await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Opening Day', body: 'Who is going?' })));
    const id = t.discussion.id;
    await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: id, body: 'I will be there.' }));
    const th = await json(await thread(ctx('amy@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.topic.author_name).toBe('Bill H.');
    expect(th.replies).toHaveLength(1);
    expect(th.replies[0].author_name).toBe('Iron Amy');
    expect(JSON.stringify(th)).not.toContain('example.test');
    const ls = await json(await list(ctx('amy@example.test', '/api/discussions/list')));
    expect(ls.items[0]).toMatchObject({ id, reply_count: 1, mine: 0 });
    expect(JSON.stringify(ls)).not.toContain('example.test');
  });

  it('falls back to Member when the author has no name on file, and keeps old posts as topics', async () => {
    db.prepare("INSERT INTO discussions (title, body, author_email, status) VALUES ('Old', 'An old post', 'ghost@example.test', 'posted')").run();
    const ls = await json(await list(ctx('bill@example.test', '/api/discussions/list')));
    expect(ls.items.find((i: any) => i.title === 'Old')).toMatchObject({ author_name: 'Member', reply_count: 0 });
  });

  it('refuses replies to a missing, hidden or closed topic, and replies to replies', async () => {
    const t = await json(await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Topic one', body: 'First post' })));
    const id = t.discussion.id;
    const r = await json(await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: id, body: 'A reply' })));
    expect((await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: 9999, body: 'x y' }))).status).toBe(404);
    expect((await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: r.reply.id, body: 'reply to reply' }))).status).toBe(404);
    await settings(ctx('bill@example.test', '/api/discussions/settings', { id, closed: true }));
    expect((await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: id, body: 'late reply' }))).status).toBe(409);
    await settings(ctx('bill@example.test', '/api/discussions/settings', { id, closed: false }));
    expect((await create(ctx('amy@example.test', '/api/discussions/create', { parent_id: id, body: 'back open' }))).status).toBe(200);
  });

  it('lets only the original poster change the email and close checkboxes; email is on by default', async () => {
    const t = await json(await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Mine', body: 'My topic' })));
    const id = t.discussion.id;
    let th = await json(await thread(ctx('bill@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.topic.notify_author).toBe(1);
    expect((await settings(ctx('amy@example.test', '/api/discussions/settings', { id, notify: false, closed: true }))).status).toBe(403);
    const ok = await json(await settings(ctx('bill@example.test', '/api/discussions/settings', { id, notify: false })));
    expect(ok.notify_author).toBe(0);
    th = await json(await thread(ctx('amy@example.test', `/api/discussions/thread?id=${id}`)));
    expect(th.topic.notify_author).toBeNull();
  });

  it('opts out at creation and validates input', async () => {
    const t = await json(await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Quiet', body: 'No emails please', notify: false })));
    const th = await json(await thread(ctx('bill@example.test', `/api/discussions/thread?id=${t.discussion.id}`)));
    expect(th.topic.notify_author).toBe(0);
    expect((await create(ctx('bill@example.test', '/api/discussions/create', { title: 'ab', body: 'long enough' }))).status).toBe(400);
    expect((await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Fine title', body: 'x'.repeat(4001) }))).status).toBe(400);
  });

  it('requires a member session', async () => {
    const res = await list({ env, request: new Request('https://x.test/api/discussions/list') });
    expect(res.status).toBe(401);
  });

  it('lets an admin hide a topic, which removes it from the list', async () => {
    const t = await json(await create(ctx('bill@example.test', '/api/discussions/create', { title: 'Bad topic', body: 'Something bad' })));
    expect((await hide(ctx('bill@example.test', '/api/admin/discussions/hide', { id: t.discussion.id, hidden: true }))).status).toBe(403);
    expect((await hide(ctx('admin@example.test', '/api/admin/discussions/hide', { id: t.discussion.id, hidden: true }))).status).toBe(200);
    const ls = await json(await list(ctx('amy@example.test', '/api/discussions/list')));
    expect(ls.items.find((i: any) => i.id === t.discussion.id)).toBeUndefined();
  });
});
