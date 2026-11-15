import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { onRequestGet } from '../functions/api/social/edition-plan';

const TOKEN = 'test-bridge-token';

function makeDb() {
  const d = new DatabaseSync(':memory:');
  for (const f of readdirSync(resolve(process.cwd(), 'migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    d.exec(readFileSync(resolve(process.cwd(), 'migrations', f), 'utf8'));
  }
  const insert = d.prepare(
    `INSERT INTO edition_plan (edition_date, surface, platform, channel, content_item_id, text, link, image_url, image_alt, skip, skip_reason, status, external_id, error, plan_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1')`,
  );
  for (let day = 1; day <= 20; day += 1) {
    const date = `2027-01-${String(day).padStart(2, '0')}`;
    insert.run(date, 'website', 'website', null, `s${day}`, null, null, null, null, 0, null, 'planned', null, null);
    insert.run(date, 'social', 'x', 'buffer', `s${day + 3}`, `Text ${day}`, null, `https://m/${day}.jpg`, 'alt', 0, null, 'planned', `ext-${day}`, 'a private error');
    insert.run(date, 'social', 'instagram', 'zapier', `s${day + 3}`, null, null, null, null, 1, 'no_image', 'skipped', null, null);
  }
  return {
    d,
    binding: {
      prepare(sql) {
        const stmt = d.prepare(sql);
        return { bind: (...args) => ({ all: async () => ({ results: stmt.all(...args) }) }) };
      },
    },
  };
}

function call(path, { token = TOKEN, env = {} } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return onRequestGet({
    request: new Request(`https://www.lougehrigfanclub.com/api/social/edition-plan${path}`, { headers }),
    env: { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, ...env },
  });
}

describe('GET /api/social/edition-plan (#5218)', () => {
  let db;
  beforeEach(() => {
    db = makeDb();
  });

  it('refuses a request with no token, a wrong token, or an unconfigured bridge', async () => {
    expect((await call('?from=2027-01-01', { token: null, env: { DB: db.binding } })).status).toBe(401);
    expect((await call('?from=2027-01-01', { token: 'wrong', env: { DB: db.binding } })).status).toBe(401);
    expect((await call('?from=2027-01-01', { env: { DB: db.binding, SCHEDULED_CONTENT_BRIDGE_TOKEN: '' } })).status).toBe(503);
  });

  it('says so when the database binding is missing', async () => {
    expect((await call('?from=2027-01-01')).status).toBe(503);
  });

  it('returns the next three days by default, oldest first', async () => {
    const res = await call('?from=2027-01-05', { env: { DB: db.binding } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, from: '2027-01-05', to: '2027-01-07', days: 3 });
    expect(body.rows).toHaveLength(9);
    expect(body.rows[0].edition_date).toBe('2027-01-05');
    expect(body.rows.at(-1).edition_date).toBe('2027-01-07');
  });

  it('leaves out the posting bookkeeping', async () => {
    const body = await (await call('?from=2027-01-05&days=1&platform=x', { env: { DB: db.binding } })).json();
    expect(body.rows).toHaveLength(1);
    expect(Object.keys(body.rows[0]).sort()).toEqual(
      ['channel', 'content_item_id', 'edition_date', 'image_alt', 'image_url', 'link', 'plan_version', 'platform', 'skip', 'skip_reason', 'status', 'story_ref', 'surface', 'text'].sort(),
    );
    expect(JSON.stringify(body)).not.toMatch(/ext-|private error|external_id|posted_at/);
  });

  it('filters by surface and platform, and a skipped row stays visible with its reason', async () => {
    const social = await (await call('?from=2027-01-05&days=1&surface=social', { env: { DB: db.binding } })).json();
    expect(social.rows.map((r) => r.platform)).toEqual(['instagram', 'x']);
    expect(social.rows[0]).toMatchObject({ skip: 1, skip_reason: 'no_image', status: 'skipped' });
    const website = await (await call('?from=2027-01-05&days=2&surface=website', { env: { DB: db.binding } })).json();
    expect(website.rows).toHaveLength(2);
  });

  it('returns an empty list for a window with no plan', async () => {
    const body = await (await call('?from=2028-06-01', { env: { DB: db.binding } })).json();
    expect(body.rows).toEqual([]);
  });

  it('rejects bad input with a 400', async () => {
    for (const q of ['?from=2027-02-30', '?from=tomorrow', '?from=2027-01-01&days=0', '?from=2027-01-01&days=15', '?from=2027-01-01&days=1.5', '?from=2027-01-01&surface=email', '?from=2027-01-01&platform=tiktok']) {
      expect((await call(q, { env: { DB: db.binding } })).status, q).toBe(400);
    }
  });

  it('cannot change anything: the module exports no write method', async () => {
    const mod = await import('../functions/api/social/edition-plan');
    expect(Object.keys(mod)).toEqual(['onRequestGet']);
    const body = await (await call('?from=2027-01-01&days=14', { env: { DB: db.binding } })).json();
    expect(body.rows).toHaveLength(42);
    expect(db.d.prepare('SELECT COUNT(*) n FROM edition_plan').get().n).toBe(60);
  });
});
