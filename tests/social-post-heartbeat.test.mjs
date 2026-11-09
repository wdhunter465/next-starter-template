import { describe, expect, it } from 'vitest';
import { evaluateHeartbeat, newYorkParts, postsDueToday, run } from '../scripts/ops/social-post-heartbeat.mjs';

const post = (over = {}) => ({
  id: 'p1',
  publish_at: '2026-11-10T10:00:00-05:00',
  text: 't',
  photo_id: 1,
  alt_text: 'a',
  platforms: ['x', 'facebook', 'instagram', 'pinterest'],
  sources: 's',
  status: 'approved',
  ...over,
});
const queue = (posts) => ({
  lateness_hours: 4,
  rights_cleared_photo_ids: [1, 2],
  footer_required: 'f',
  automation_starts_at: '2026-11-10T00:00:00-05:00',
  posts: posts.map((p) => ({ ...p, text: 'x\nf' })),
});

describe('social post heartbeat', () => {
  it('reads the New York date and hour across the clock change', () => {
    expect(newYorkParts(Date.parse('2026-11-10T17:00:00Z'))).toEqual({ date: '2026-11-10', hour: 12 });
    expect(newYorkParts(Date.parse('2026-07-10T16:00:00Z'))).toEqual({ date: '2026-07-10', hour: 12 });
    expect(newYorkParts(Date.parse('2026-11-11T04:59:00Z')).date).toBe('2026-11-10');
  });

  it('selects only automated posts dated today', () => {
    const q = queue([post(), post({ id: 'old', publish_at: '2026-11-09T10:00:00-05:00' }), post({ id: 'next', publish_at: '2026-11-11T10:00:00-05:00' })]);
    expect(postsDueToday(q, Date.parse('2026-11-10T17:00:00Z')).map((p) => p.id)).toEqual(['p1']);
  });

  it('is clean when X is posted, the item is in the feed and the image works', () => {
    const facts = { p1: { ledgerRows: [{ platform: 'x', status: 'posted' }], inFeed: true, imageOk: true } };
    expect(evaluateHeartbeat([post()], facts)).toEqual([]);
  });

  it('reports a missing X row, a failed attempt, a missing feed item and a bad image', () => {
    expect(evaluateHeartbeat([post()], { p1: { ledgerRows: [], inFeed: true, imageOk: true } }).join()).toMatch(/X has no posted ledger row/);
    expect(
      evaluateHeartbeat([post()], { p1: { ledgerRows: [{ platform: 'x', status: 'failed', error: 'boom' }], inFeed: true, imageOk: true } }).join(),
    ).toMatch(/last attempt failed: boom/);
    expect(evaluateHeartbeat([post()], { p1: { ledgerRows: [{ platform: 'x', status: 'posted' }], inFeed: false, imageOk: false } })).toHaveLength(2);
  });

  it('does nothing before the deadline hour', async () => {
    const report = await run({ NOW: '2026-11-10T15:30:00Z', SCHEDULED_CONTENT_BRIDGE_TOKEN: 't' }, { queue: queue([post()]), fetch: async () => { throw new Error('no fetch'); } });
    expect(report.note).toMatch(/before 12:00/);
  });

  it('fetches the feed, ledger and image after the deadline and reports problems', async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith('/api/social/feed')) return new Response('<guid isPermaLink="false">p1</guid>', { status: 200 });
      if (url.includes('/api/social/ledger')) return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      return new Response('IMG', { status: 200, headers: { 'content-type': 'image/jpeg' } });
    };
    const report = await run({ NOW: '2026-11-10T17:00:00Z', SCHEDULED_CONTENT_BRIDGE_TOKEN: 't' }, { queue: queue([post()]), fetch: fetchImpl });
    expect(report.checked).toEqual(['p1']);
    expect(report.problems.join()).toMatch(/X has no posted ledger row/);
  });
});
