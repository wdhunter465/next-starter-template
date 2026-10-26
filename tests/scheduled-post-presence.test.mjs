import { describe, expect, it } from 'vitest';

import {
  EXCEPTION_LABELS,
  evaluatePresence,
  expectedKeysFromComments,
  handleScheduledPostPresence,
  publishedKeysFromComment,
} from '../scripts/ops/scheduled-post-presence.mjs';

const REPO = 'wdhunter465/next-starter-template';
const NY_DATE = '2026-10-26';
const LIST_URL = 'https://www.lougehrigfanclub.com/api/fundraiser-details/list?limit=30';

function comment(body, createdAt = '2026-10-26T14:05:00Z') {
  return { created_at: createdAt, body };
}

function successBody(keys) {
  const published = keys.map((key) => ({ key }));
  return [
    '## Scheduled content publish sweep — published 1 item(s)',
    '',
    'Run: https://github.com/wdhunter465/next-starter-template/actions/runs/1',
    '',
    '```',
    JSON.stringify({ ok: true, published }),
    '```',
  ].join('\n');
}

function makeApi({ openIssues = [] } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'GET' && path.includes('/issues?')) return openIssues;
    if (method === 'POST' && path.endsWith('/issues')) return { number: 910 };
    if (method === 'POST' && path.endsWith('/comments')) return { id: 1 };
    throw new Error(`Unexpected call ${method} ${path}`);
  };
  return { api, calls };
}

describe('scheduled post presence (#4684)', () => {
  it('reads published keys from a successful sweep comment', () => {
    expect(publishedKeysFromComment(successBody(['home.fundraiser-daily-details.2026-10-26']))).toEqual([
      'home.fundraiser-daily-details.2026-10-26',
    ]);
    expect(publishedKeysFromComment('## Scheduled content publish sweep — FAILED (HTTP 401)\n\n```\n{}\n```')).toEqual(
      [],
    );
  });

  it('passes quietly when no post was published today', async () => {
    const { api, calls } = makeApi();
    const result = await handleScheduledPostPresence({
      comments: [comment('nothing due')],
      items: [],
      nyDate: NY_DATE,
      listUrl: LIST_URL,
      api,
      repo: REPO,
    });

    expect(result).toEqual({ action: 'quiet', expectedKeys: [] });
    expect(expectedKeysFromComments([], NY_DATE)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('opens one Operations Issue when the published key is missing from the public list', async () => {
    const { api, calls } = makeApi();
    const key = 'home.fundraiser-daily-details.2026-10-26';
    const result = await handleScheduledPostPresence({
      comments: [comment(successBody([key]))],
      items: [{ key: 'home.fundraiser-daily-details.2026-10-25' }],
      nyDate: NY_DATE,
      listUrl: LIST_URL,
      api,
      repo: REPO,
    });

    expect(result.action).toBe('created');
    expect(result.missing).toEqual([key]);
    const created = calls.find((call) => call.method === 'POST' && call.path.endsWith('/issues'));
    expect(created.body.title).toBe('OPS EXCEPTION: scheduled post missing after 10:00');
    expect(created.body.labels).toEqual(EXCEPTION_LABELS);
    expect(created.body.labels.some((label) => label.startsWith('agent:'))).toBe(false);
    expect(created.body.body).toContain(key);
    expect(created.body.body).toContain(LIST_URL);
    expect(created.body.body).toContain('#4407');
  });

  it('opens nothing when the published key is on the public list', async () => {
    const key = 'home.fundraiser-daily-details.2026-10-26';
    const { api, calls } = makeApi();
    const result = await handleScheduledPostPresence({
      comments: [comment(successBody([key]))],
      items: [{ key }],
      nyDate: NY_DATE,
      listUrl: LIST_URL,
      api,
      repo: REPO,
    });

    expect(result.action).toBe('present');
    expect(evaluatePresence({ expectedKeys: [key], items: [{ key }] }).action).toBe('present');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('comments on the open Issue instead of opening a second one', async () => {
    const key = 'home.fundraiser-daily-details.2026-10-26';
    const { api, calls } = makeApi({
      openIssues: [{ number: 77, body: '<!-- ops-scheduled-post-missing -->\nexisting' }],
    });
    const result = await handleScheduledPostPresence({
      comments: [comment(successBody([key]))],
      items: [],
      nyDate: NY_DATE,
      listUrl: LIST_URL,
      api,
      repo: REPO,
    });

    expect(result).toMatchObject({ action: 'commented', number: 77 });
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/issues'))).toBe(false);
  });
});
