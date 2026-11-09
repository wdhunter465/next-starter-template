import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCreatePostArgs, recordLedger, run, selectXPosts } from '../scripts/ops/social-post-x.mjs';

const real = JSON.parse(readFileSync('data/social-post-queue.json', 'utf8'));
const T = (s) => Date.parse(s);

function fakeSite(rowsByPost = {}) {
  const writes = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      writes.push(row);
      return json(201, { ok: true });
    }
    return json(200, { ok: true, rows: rowsByPost[u.searchParams.get('post_id')] ?? [] });
  };
  return { fetchImpl, writes };
}

const env = { SCHEDULED_CONTENT_BRIDGE_TOKEN: 't', BUFFER_API_KEY: 'k' };

describe('X posting', () => {
  it('leaves posts before automation_starts_at to the manual process', () => {
    expect(real.automation_starts_at).toBeTruthy();
    expect(selectXPosts(real, T('2026-11-09T15:30:00Z'))).toEqual([]);
    expect(selectXPosts(real, T('2026-11-10T15:30:00Z')).map((p) => p.id)).toEqual(['2026-11-10-daily']);
  });

  it('builds a Buffer post with the published-only image and alt text', () => {
    const args = buildCreatePostArgs(real.posts[1], 'c1', 'https://example.test');
    expect(args).toMatchObject({ channelId: 'c1', schedulingType: 'automatic', mode: 'shareNow' });
    expect(args.assets[0].image.url).toBe('https://example.test/api/social/image/2026-11-10-daily');
    expect(args.assets[0].image.metadata.altText).toBe(real.posts[1].alt_text);
  });

  it('dry run reads the ledger, posts nothing and writes nothing', async () => {
    const { fetchImpl, writes } = fakeSite();
    const report = await run({ ...env, NOW: '2026-11-10T15:30:00Z' }, { fetch: fetchImpl });
    expect(report.mode).toBe('dry-run');
    expect(report.skipped[0]).toMatchObject({ id: '2026-11-10-daily', reason: 'dry run' });
    expect(writes).toEqual([]);
  });

  it('posts once, records the ledger, and a post already in the ledger is not sent again', async () => {
    const calls = [];
    const client = { callTool: async (name, args) => (calls.push({ name, args }), { id: 'buf-1' }) };
    const first = fakeSite();
    const r1 = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:30:00Z' }, { fetch: first.fetchImpl, client });
    expect(r1.posted).toEqual([{ id: '2026-11-10-daily', platform_post_id: 'buf-1' }]);
    expect(first.writes[0]).toMatchObject({ post_id: '2026-11-10-daily', platform: 'x', status: 'posted', platform_post_id: 'buf-1' });

    const second = fakeSite({ '2026-11-10-daily': [{ platform: 'x', status: 'posted' }] });
    const r2 = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:45:00Z' }, { fetch: second.fetchImpl, client });
    expect(r2.skipped[0].reason).toBe('already posted');
    expect(calls).toHaveLength(1);
  });

  it('records a failed row and reports the failure when Buffer errors', async () => {
    const client = { callTool: async () => { throw new Error('buffer down'); } };
    const site = fakeSite();
    const report = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:30:00Z' }, { fetch: site.fetchImpl, client });
    expect(report.failed[0]).toMatchObject({ id: '2026-11-10-daily', step: 'buffer' });
    expect(site.writes[0]).toMatchObject({ status: 'failed', platform: 'x' });
  });

  it('retries a failed ledger write and accepts a 409', async () => {
    let n = 0;
    const fetchImpl = async () => new Response('{}', { status: ++n < 3 ? 500 : 409 });
    expect((await recordLedger(fetchImpl, 'https://x.test', 't', {})).status).toBe(409);
    expect(n).toBe(3);
  });
});
