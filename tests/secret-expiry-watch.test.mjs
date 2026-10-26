import { describe, expect, it } from 'vitest';

import {
  EXCEPTION_LABELS,
  dueNames,
  handleSecretExpiry,
  parseExpiryRows,
} from '../scripts/ops/secret-expiry-watch.mjs';

const REPO = 'wdhunter465/next-starter-template';
const NOW = new Date('2026-10-26T00:00:00Z');

function register(rows) {
  const body = rows.map((row) => `| ${row.name} | ${row.expires} |`).join('\n');
  return `<!-- asset-register:expiry:start -->
| name | expires |
| --- | --- |
${body}
<!-- asset-register:expiry:end -->`;
}

function makeApi({ openIssues = [] } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'GET' && path.includes('/issues?')) return openIssues;
    if (method === 'POST' && path.endsWith('/issues')) return { number: 930 };
    if (method === 'POST' && path.endsWith('/comments')) return { id: 1 };
    throw new Error(`Unexpected call ${method} ${path}`);
  };
  return { api, calls };
}

describe('secret expiry watch (#4691)', () => {
  it('reads names and dates and ignores a table with no dates', () => {
    const rows = parseExpiryRows(register([{ name: 'CLOUDFLARE_API_TOKEN', expires: '2026-11-20' }]));
    expect(rows).toEqual([{ name: 'CLOUDFLARE_API_TOKEN', expires: '2026-11-20' }]);
    expect(parseExpiryRows(register([]))).toEqual([]);
  });

  it('opens one Issue naming the secret and not the date value when expiry is inside 30 days', async () => {
    const rows = [{ name: 'CURSOR_RUNNER_HEALTH_TOKEN', expires: '2026-11-10' }];
    const { api, calls } = makeApi();
    const result = await handleSecretExpiry({ rows, now: NOW, api, repo: REPO });
    expect(result).toEqual({ action: 'created', number: 930 });
    expect(dueNames(rows, NOW)).toEqual(['CURSOR_RUNNER_HEALTH_TOKEN']);
    const created = calls.find((call) => call.method === 'POST' && call.path.endsWith('/issues'));
    expect(created.body.labels).toEqual(EXCEPTION_LABELS);
    expect(created.body.body).toContain('CURSOR_RUNNER_HEALTH_TOKEN');
    expect(created.body.body).not.toContain('2026-11-10');
  });

  it('stays quiet when the only recorded date is outside 30 days', async () => {
    const { api, calls } = makeApi();
    const result = await handleSecretExpiry({
      rows: [{ name: 'GITLEAKS_LICENSE', expires: '2027-06-01' }],
      now: NOW,
      api,
      repo: REPO,
    });
    expect(result).toEqual({ action: 'quiet' });
    expect(calls).toEqual([]);
  });

  it('comments on the open Issue instead of opening a second one', async () => {
    const { api, calls } = makeApi({
      openIssues: [{ number: 81, body: '<!-- ops-secret-expiry -->\nexisting' }],
    });
    const result = await handleSecretExpiry({
      rows: [{ name: 'HF_TOKEN', expires: '2026-10-26' }],
      now: NOW,
      api,
      repo: REPO,
    });
    expect(result).toEqual({ action: 'commented', number: 81 });
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/issues'))).toBe(false);
  });
});
