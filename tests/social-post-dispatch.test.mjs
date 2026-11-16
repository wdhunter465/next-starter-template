import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIssue, handoffTarget, run, selectDispatchPosts } from '../scripts/ops/social-post-dispatch.mjs';
import { findCoverageGaps, phaseForDate, validateMessaging } from '../scripts/ops/social-post-queue.mjs';

const queue = JSON.parse(readFileSync('data/social-post-queue.json', 'utf8'));
const calendar = JSON.parse(readFileSync('data/social-messaging-calendar.json', 'utf8'));
const env = { SCHEDULED_CONTENT_BRIDGE_TOKEN: 't', GITHUB_TOKEN: 'g', GITHUB_REPOSITORY: 'o/r', APPLY: 'true', NOW: '2026-11-10T15:10:00Z' };

function fakeWorld(ledgerRows = []) {
  const created = [];
  const ledger = [];
  const fetchImpl = async (url, init = {}) => {
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (String(url).includes('/api/social/ledger')) {
      if (init.method === 'POST') {
        ledger.push(JSON.parse(init.body));
        return json(201, { ok: true });
      }
      return json(200, { ok: true, rows: ledgerRows });
    }
    if (init.method === 'POST') {
      const issue = { number: 100 + created.length, ...JSON.parse(init.body) };
      created.push(issue);
      return json(201, issue);
    }
    if (init.method === 'PATCH') return json(200, {});
    return json(200, []);
  };
  return { fetchImpl, created, ledger };
}

describe('hand-off to Zapier', () => {
  it('uses the image address as title and the exact text as body', () => {
    const issue = buildIssue(queue.posts[1], 'pinterest', 'https://x.test');
    expect(issue.title).toBe('https://x.test/api/social/image/2026-11-10-daily');
    expect(issue.body).toBe(queue.posts[1].text);
    expect(issue.labels).toEqual(['social-post', 'social:pinterest', 'team:operations', 'area:social']);
  });

  it('points Instagram at the padded variant and every other platform at the original (#5196)', () => {
    expect(buildIssue(queue.posts[1], 'instagram', 'https://x.test').title).toBe('https://x.test/api/social/image/2026-11-10-daily?for=instagram');
    expect(buildIssue(queue.posts[1], 'facebook', 'https://x.test').title).toBe('https://x.test/api/social/image/2026-11-10-daily');
  });

  it('selects nothing before the publish time and the post after it', () => {
    expect(selectDispatchPosts(queue, Date.parse('2026-11-10T14:59:00Z'))).toEqual([]);
    expect(selectDispatchPosts(queue, Date.parse('2026-11-10T15:00:00Z')).map((p) => p.id)).toEqual(['2026-11-10-daily']);
  });

  it('dry run opens nothing and writes nothing', async () => {
    const w = fakeWorld();
    const r = await run({ ...env, APPLY: 'false' }, { fetch: w.fetchImpl });
    expect(w.created).toEqual([]);
    expect(w.ledger).toEqual([]);
    expect(r.skipped.map((s) => s.platform)).toEqual(['facebook', 'instagram', 'pinterest']);
  });

  it('opens one Issue per Zapier platform and records each in the ledger', async () => {
    const w = fakeWorld();
    const r = await run(env, { fetch: w.fetchImpl });
    expect(r.failed).toEqual([]);
    expect(w.created.map((i) => i.labels[1])).toEqual(['social:facebook', 'social:instagram', 'social:pinterest']);
    expect(w.ledger.map((l) => l.platform)).toEqual(['facebook', 'instagram', 'pinterest']);
  });

  it('does not hand off a platform the ledger already has', async () => {
    const w = fakeWorld([{ platform: 'facebook', status: 'posted' }]);
    await run(env, { fetch: w.fetchImpl });
    expect(w.created.map((i) => i.labels[1])).toEqual(['social:instagram', 'social:pinterest']);
  });
});

describe('messaging calendar', () => {
  const post = (date, text) => ({ id: `${date}-x`, publish_at: `${date}T10:00:00-05:00`, status: 'approved', text });
  it('maps the dates Product Authority set', () => {
    expect(phaseForDate(calendar, '2027-01-31').id).toBe('website-launch');
    expect(phaseForDate(calendar, '2027-02-01').id).toBe('fundraiser');
    expect(phaseForDate(calendar, '2027-05-01').id).toBe('fundraiser-auction');
    expect(phaseForDate(calendar, '2027-05-28').id).toBe('fundraiser-auction-lgd');
    expect(phaseForDate(calendar, '2027-06-01').slots).toEqual(['10:00', '18:00']);
    expect(phaseForDate(calendar, '2027-06-09').id).toBe('after-campaign');
  });
  it('requires hype in each phase and forbids it after June 8', () => {
    expect(validateMessaging({ posts: [post('2026-12-01', 'Visit the new website')] }, calendar)).toEqual([]);
    expect(validateMessaging({ posts: [post('2026-12-01', 'A 1927 story')] }, calendar)).toHaveLength(1);
    expect(validateMessaging({ posts: [post('2027-05-02', 'fundraiser only')] }, calendar)).toHaveLength(1);
    expect(validateMessaging({ posts: [post('2027-06-10', 'Join the fundraiser')] }, calendar)).toHaveLength(1);
    expect(validateMessaging({ posts: [post('2027-06-10', 'A 1927 story')] }, calendar)).toEqual([]);
  });
  it('finds queue gaps including the 18:00 slot', () => {
    const q = { posts: [post('2027-06-01', 'x')] };
    expect(findCoverageGaps(q, calendar, '2027-06-01', '2027-06-01')).toEqual(['2027-06-01 18:00']);
  });
  it('the real queue passes', () => {
    expect(validateMessaging(queue, calendar)).toEqual([]);
  });
});

describe('dedicated hand-off repositories (#5321)', () => {
  it('uses the dedicated repository and token for a platform that has one, and the main repository otherwise', () => {
    const e = { GITHUB_TOKEN: 'g', GITHUB_REPOSITORY: 'o/main', SOCIAL_HANDOFF_TOKEN: 'h', SOCIAL_HANDOFF_REPO_FACEBOOK: 'o/lgfc-social-facebook' };
    expect(handoffTarget(e, 'facebook')).toEqual({ repo: 'o/lgfc-social-facebook', token: 'h', dedicated: true });
    expect(handoffTarget(e, 'instagram')).toEqual({ repo: 'o/main', token: 'g', dedicated: false });
  });

  it('requires SOCIAL_HANDOFF_TOKEN when a dedicated repository is set and applying', async () => {
    const e = { ...env, SOCIAL_HANDOFF_REPO_FACEBOOK: 'o/lgfc-social-facebook' };
    await expect(run(e, { queue, calendar, fetch: async () => ({ status: 200, json: async () => ({ rows: [] }) }) })).rejects.toThrow(/SOCIAL_HANDOFF_TOKEN/);
  });

  it('dry run names the repository each hand-off would open in', async () => {
    const e = { SCHEDULED_CONTENT_BRIDGE_TOKEN: 't', GITHUB_REPOSITORY: 'o/main', SOCIAL_HANDOFF_REPO_FACEBOOK: 'o/lgfc-social-facebook', APPLY: 'false', NOW: '2026-11-10T15:10:00Z' };
    const report = await run(e, { queue, calendar, fetch: async () => ({ status: 200, json: async () => ({ rows: [] }) }) });
    const fb = report.skipped.find((r) => r.platform === 'facebook');
    expect(fb?.in_repo).toBe('o/lgfc-social-facebook');
  });
});
