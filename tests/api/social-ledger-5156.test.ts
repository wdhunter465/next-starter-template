// @vitest-environment node
// #5156: the social post ledger never lets a post go out twice, and the image route serves only
// the photo of a post whose publish time has arrived.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestGet as ledgerGet, onRequestPost as ledgerPost } from '../../functions/api/social/ledger';
import { onRequestGet as imageGet } from '../../functions/api/social/image/[id]';
import { isPublished } from '../../functions/_lib/social-queue';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  const prepare = (sql: string) => {
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
    return { bind: bound };
  };
  return { sqlite, db: { prepare } };
}

const TOKEN = 'bridge-token';
const POST = '2026-11-09-daily';
const req = (method: string, body?: unknown, query = '') =>
  new Request(`https://example.test/api/social/ledger${query}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('social post ledger', () => {
  it('rejects a call without the bridge token', async () => {
    const { db } = makeDb();
    const res = await ledgerPost({
      request: new Request('https://example.test/api/social/ledger', { method: 'POST', body: '{}' }),
      env: { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN },
    });
    expect(res.status).toBe(401);
  });

  it('records a post once and refuses a second send with 409', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };
    const body = { post_id: POST, platform: 'x', status: 'posted', platform_post_id: '123' };
    expect((await ledgerPost({ request: req('POST', body), env })).status).toBe(201);
    expect((await ledgerPost({ request: req('POST', body), env })).status).toBe(409);
    const list = await (await ledgerGet({ request: req('GET', undefined, `?post_id=${POST}`), env })).json();
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]).toMatchObject({ platform: 'x', status: 'posted', attempts: 1 });
  });

  it('lets a failed row be retried and counts the attempts', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };
    await ledgerPost({ request: req('POST', { post_id: POST, platform: 'pinterest', status: 'failed', error: 'boom' }), env });
    const retry = await ledgerPost({ request: req('POST', { post_id: POST, platform: 'pinterest', status: 'posted' }), env });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ status: 'posted', attempts: 2 });
  });

  it('rejects an unknown post, platform or status', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };
    for (const body of [
      { post_id: 'nope', platform: 'x', status: 'posted' },
      { post_id: POST, platform: 'myspace', status: 'posted' },
      { post_id: POST, platform: 'x', status: 'maybe' },
    ]) {
      expect((await ledgerPost({ request: req('POST', body), env })).status).toBe(400);
    }
  });
});

describe('social image route', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const call = (db: unknown, id: string) =>
    imageGet({
      request: new Request(`https://example.test/api/social/image/${id}`),
      env: { DB: db },
      params: { id },
    });

  it('is not published before its time and is published after', () => {
    const post = { id: 'p', publish_at: '2026-11-09T10:00:00-05:00', status: 'approved' } as any;
    expect(isPublished(post, Date.parse('2026-11-09T14:59:59Z'))).toBe(false);
    expect(isPublished(post, Date.parse('2026-11-09T15:00:00Z'))).toBe(true);
    expect(isPublished({ ...post, status: 'draft' }, Date.parse('2026-11-10T00:00:00Z'))).toBe(false);
  });

  it('returns 404 before the publish time and for an unknown id', async () => {
    const { db } = makeDb();
    vi.setSystemTime(new Date('2026-11-09T14:00:00Z'));
    expect((await call(db, POST)).status).toBe(404);
    expect((await call(db, 'not-a-post')).status).toBe(404);
  });

  it('streams the photo after the publish time, and 404s a photo that is no longer rights-cleared', async () => {
    const { sqlite, db } = makeDb();
    sqlite
      .prepare("INSERT INTO photos (id, url, rights_hold, publication_eligible) VALUES (858, 'https://s3.us-east-005.backblazeb2.com/LouGehrigFanClub/a.jpg', 0, 1)")
      .run();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('IMG', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })));
    vi.setSystemTime(new Date('2026-11-09T15:01:00Z'));

    const ok = await call(db, POST);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Content-Type')).toBe('image/jpeg');
    expect(await ok.text()).toBe('IMG');

    sqlite.prepare('UPDATE photos SET rights_hold = 1 WHERE id = 858').run();
    expect((await call(db, POST)).status).toBe(404);
  });
});
