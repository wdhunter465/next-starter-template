import fs, { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from '../functions/api/social/archive';
import {
  parseArgs,
  postsToArchive,
  renderReport,
  syncArchive,
} from '../scripts/ops/social-archive-sync.mjs';

const TOKEN = 'test-bridge-token';
const queue = JSON.parse(readFileSync(resolve(process.cwd(), 'data/social-post-queue.json'), 'utf8'));
const PUBLISHED = queue.posts.find((p) => p.status === 'approved');
const NOW = Date.parse(PUBLISHED.publish_at) + 3_600_000;

function makeDb() {
  const d = new DatabaseSync(':memory:');
  for (const f of readdirSync(resolve(process.cwd(), 'migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    d.exec(readFileSync(resolve(process.cwd(), 'migrations', f), 'utf8'));
  }
  return {
    d,
    binding: {
      prepare(sql) {
        const stmt = d.prepare(sql);
        return {
          bind: (...args) => ({
            all: async () => ({ results: stmt.all(...args) }),
            first: async () => stmt.get(...args) ?? null,
            run: async () => stmt.run(...args),
          }),
        };
      },
    },
  };
}

const ledger = (d, postId, platform, status = 'posted', platformPostId = 'plat-1') =>
  d.prepare('INSERT INTO social_post_ledger (post_id, platform, status, platform_post_id) VALUES (?, ?, ?, ?)').run(postId, platform, status, platformPostId);

const call = (db, body, { token = TOKEN } = {}) =>
  onRequestPost({
    request: new Request('https://www.lougehrigfanclub.com/api/social/archive', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env: { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, DB: db.binding },
  });

describe('POST /api/social/archive (#5097)', () => {
  let db;
  beforeEach(() => {
    db = makeDb();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('refuses a request with no token, a wrong token, or no database', async () => {
    expect((await call(db, { post_id: PUBLISHED.id }, { token: null })).status).toBe(401);
    expect((await call(db, { post_id: PUBLISHED.id }, { token: 'wrong' })).status).toBe(401);
    const noDb = await onRequestPost({
      request: new Request('https://x/api/social/archive', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{}' }),
      env: { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN },
    });
    expect(noDb.status).toBe(503);
  });

  it('rejects bad JSON and a post that is not in the reviewed queue', async () => {
    expect((await call(db, 'not json')).status).toBe(400);
    expect((await call(db, { post_id: 'made-up' })).status).toBe(400);
    expect((await call(db, {})).status).toBe(400);
  });

  it('refuses a post whose publish time has not arrived', async () => {
    vi.setSystemTime(Date.parse(PUBLISHED.publish_at) - 3_600_000);
    ledger(db.d, PUBLISHED.id, 'x');
    const res = await call(db, { post_id: PUBLISHED.id });
    expect(res.status).toBe(409);
    expect(db.d.prepare('SELECT COUNT(*) n FROM content_items').get().n).toBe(0);
  });

  it('refuses a post the ledger does not show as posted, including a failed attempt', async () => {
    expect((await call(db, { post_id: PUBLISHED.id })).status).toBe(409);
    ledger(db.d, PUBLISHED.id, 'x', 'failed', null);
    const res = await call(db, { post_id: PUBLISHED.id });
    expect(res.status).toBe(409);
    expect(db.d.prepare('SELECT COUNT(*) n FROM content_items').get().n).toBe(0);
  });

  it('writes one row from the queue and the ledger, never from the request body', async () => {
    ledger(db.d, PUBLISHED.id, 'x', 'posted', 'buffer-abc');
    const res = await onRequestPost({
      request: new Request('https://x/api/social/archive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: PUBLISHED.id, text: 'INJECTED', title: 'INJECTED', rights_status: 'permission_granted' }),
      }),
      env: { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, DB: db.binding },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, post_id: PUBLISHED.id, review_status: 'pending_review', publication_status: 'not_ready', sent_platforms: ['x'] });
    const row = db.d.prepare('SELECT * FROM content_items WHERE candidate_id = ?').get(`social-post-${PUBLISHED.id}`);
    expect(row.id).toBe(body.content_item_id);
    expect(row.summary).toBe(PUBLISHED.text);
    expect(row.title).toBe(PUBLISHED.topic);
    expect(JSON.stringify(row)).not.toContain('INJECTED');
    const meta = JSON.parse(row.source_metadata);
    expect(meta).toMatchObject({ kind: 'daily_social_post', photo_id: PUBLISHED.photo_id });
    expect(meta.sent).toEqual([expect.objectContaining({ platform: 'x', platform_post_id: 'buffer-abc' })]);
  });

  it('sets no approval, no publication and no rights conclusion', async () => {
    ledger(db.d, PUBLISHED.id, 'x');
    await call(db, { post_id: PUBLISHED.id });
    const row = db.d.prepare('SELECT * FROM content_items WHERE candidate_id = ?').get(`social-post-${PUBLISHED.id}`);
    expect(row).toMatchObject({
      review_status: 'pending_review',
      publication_status: 'not_ready',
      publication_target: 'social',
      rights_status: 'unknown',
      curator_decision: 'pending',
      content_type: 'timeline_fact',
    });
    expect(row.deleted_at).toBeNull();
  });

  it('is idempotent: a rerun adds no row and refreshes only the sent details', async () => {
    ledger(db.d, PUBLISHED.id, 'x', 'posted', 'p1');
    const first = await (await call(db, { post_id: PUBLISHED.id })).json();
    db.d.prepare("UPDATE content_items SET review_status = 'approved_public_candidate', admin_notes = 'checked by a person' WHERE id = ?").run(first.content_item_id);
    ledger(db.d, PUBLISHED.id, 'instagram', 'handed_off', 'issue#5182');
    const second = await (await call(db, { post_id: PUBLISHED.id })).json();
    expect(second.content_item_id).toBe(first.content_item_id);
    expect(db.d.prepare('SELECT COUNT(*) n FROM content_items').get().n).toBe(1);
    const row = db.d.prepare('SELECT * FROM content_items WHERE id = ?').get(first.content_item_id);
    expect(JSON.parse(row.source_metadata).sent.map((s) => s.platform).sort()).toEqual(['instagram', 'x']);
    // what a person decided is untouched
    expect(row.review_status).toBe('approved_public_candidate');
    expect(row.admin_notes).toBe('checked by a person');
  });

  it('exports only the POST handler', async () => {
    const mod = await import('../functions/api/social/archive');
    expect(Object.keys(mod).sort()).toEqual(['archiveCandidateId', 'onRequestPost']);
  });
});

describe('social archive sync script (#5097)', () => {
  const posts = [
    { id: 'a', status: 'approved', publish_at: '2026-11-09T10:00:00-05:00' },
    { id: 'b', status: 'approved', publish_at: '2026-11-12T10:00:00-05:00' },
    { id: 'c', status: 'approved', publish_at: '2026-11-14T10:00:00-05:00' },
    { id: 'draft', status: 'draft', publish_at: '2026-11-13T10:00:00-05:00' },
    { id: 'future', status: 'approved', publish_at: '2026-12-01T10:00:00-05:00' },
  ];
  const now = Date.parse('2026-11-15T12:00:00Z');

  it('picks approved, already published posts in the window, oldest first', () => {
    expect(postsToArchive(posts, { now, days: 3 }).map((p) => p.id)).toEqual(['b', 'c']);
    expect(postsToArchive(posts, { now, all: true }).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(postsToArchive(undefined, { now })).toEqual([]);
  });

  it('parses its arguments and rejects bad ones', () => {
    expect(parseArgs([])).toEqual({ days: 3, all: false, dryRun: false });
    expect(parseArgs(['--all', '--dry-run'])).toMatchObject({ all: true, dryRun: true });
    expect(parseArgs(['--days', '7']).days).toBe(7);
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--days', '0'])).toThrow(/positive/);
  });

  const reply = (status, data) => async () => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  it('archives, treats 409 as not sent yet, and records failures without throwing', async () => {
    const answers = [
      reply(200, { ok: true, content_item_id: 7, sent_platforms: ['x'] }),
      reply(409, { ok: false, error: 'post has not been recorded as posted' }),
      reply(500, { ok: false, error: 'boom' }),
      async () => { throw new Error('socket hang up'); },
    ];
    let i = 0;
    const report = await syncArchive({ posts: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }], baseUrl: 'https://x', token: 't', fetchImpl: (...a) => answers[i++](...a) });
    expect(report.archived).toEqual([{ id: 'p1', content_item_id: 7, sent_platforms: ['x'] }]);
    expect(report.skipped).toEqual([{ id: 'p2', reason: 'post has not been recorded as posted' }]);
    expect(report.failed).toEqual([
      { id: 'p3', status: 500, error: 'boom' },
      { id: 'p4', status: 0, error: 'socket hang up' },
    ]);
    const text = renderReport(report);
    expect(text).toContain('Archived: 1. Skipped: 1. Failed: 2.');
    expect(text).toContain('p3: FAILED (500) boom');
  });

  it('sends only the post id with the bearer token, and nothing in a dry run', async () => {
    const fetchImpl = vi.fn(reply(200, { ok: true, content_item_id: 1, sent_platforms: ['x'] }));
    await syncArchive({ posts: [{ id: 'p1', text: 'must not be sent' }], baseUrl: 'https://x', token: 'tok', fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://x/api/social/archive');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ post_id: 'p1' });
    const dry = vi.fn();
    const report = await syncArchive({ posts: [{ id: 'p1' }], baseUrl: 'https://x', token: 't', fetchImpl: dry, dryRun: true });
    expect(dry).not.toHaveBeenCalled();
    expect(report.skipped).toEqual([{ id: 'p1', reason: 'dry_run' }]);
  });
});

describe('the posting workflow runs the archive step safely (#5097)', () => {
  const workflow = fs.readFileSync('.github/workflows/ops-social-post-x.yml', 'utf8');
  const steps = workflow.split(/\n      - name: /).slice(1);
  const names = steps.map((block) => block.split('\n')[0]);
  const archive = steps.find((block) => block.startsWith('Save the posts to the archive'));

  it('has the step, after the post step and before the evidence save', () => {
    const at = (prefix) => names.findIndex((n) => n.startsWith(prefix));
    expect(archive).toBeTruthy();
    expect(at('Post due X posts')).toBeLessThan(at('Save the posts to the archive'));
    expect(at('Save the posts to the archive')).toBeLessThan(at('Save the evidence records'));
  });

  it('never blocks or repeats a post: continue-on-error, real runs only, after the post step has finished', () => {
    expect(archive).toMatch(/continue-on-error: true/);
    expect(archive).toMatch(/env\.APPLY == 'true'/);
    expect(archive).toMatch(/node scripts\/ops\/social-archive-sync\.mjs/);
  });

  it('adds no permission and no secret to the workflow', () => {
    expect(workflow).toMatch(/permissions:\n  contents: write[^\n]*\n  issues: write\n/);
    expect(archive).not.toMatch(/secrets\./);
  });
});
