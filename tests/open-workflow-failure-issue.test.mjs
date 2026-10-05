import { describe, expect, it } from 'vitest';

import {
  EXCEPTION_LABELS,
  exceptionMarker,
  exceptionTitle,
  getFailedSteps,
  handleWorkflowFailure,
  renderIssueBody,
} from '../scripts/ci/open_workflow_failure_issue.mjs';

const REPO = 'wdhunter465/next-starter-template';

function makeRun(overrides = {}) {
  return {
    id: '123',
    name: 'OPS — Scheduled Content Publish (#4253)',
    url: 'https://github.com/wdhunter465/next-starter-template/actions/runs/123',
    conclusion: 'failure',
    event: 'schedule',
    sha: 'abc1234',
    ...overrides,
  };
}

function makeApi({ openIssues = [], jobs = { jobs: [] }, jobsError = false } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'GET' && path.includes('/actions/runs/')) {
      if (jobsError) throw new Error('jobs unavailable');
      return jobs;
    }
    if (method === 'GET' && path.includes('/issues?')) return openIssues;
    if (method === 'POST' && path.endsWith('/issues')) return { number: 900 };
    if (method === 'POST' && path.endsWith('/comments')) return { id: 1 };
    throw new Error(`Unexpected call ${method} ${path}`);
  };
  return { api, calls };
}

describe('workflow failure exception issues (#4444)', () => {
  it('opens a team:operations Issue on the first failure', async () => {
    const { api, calls } = makeApi();
    const result = await handleWorkflowFailure({ run: makeRun(), api, repo: REPO });

    expect(result).toEqual({ action: 'created', number: 900 });
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
    expect(created.body.title).toBe(exceptionTitle('OPS — Scheduled Content Publish (#4253)'));
    expect(created.body.labels).toEqual(EXCEPTION_LABELS);
    expect(created.body.labels).toContain('team:operations');
    expect(created.body.labels.some((label) => label.startsWith('agent:'))).toBe(false);
    expect(created.body.body).toContain(exceptionMarker('OPS — Scheduled Content Publish (#4253)'));
    expect(created.body.body).toContain('https://github.com/wdhunter465/next-starter-template/actions/runs/123');
  });

  it('comments on the existing open Issue instead of opening a duplicate', async () => {
    const marker = exceptionMarker('OPS — Scheduled Content Publish (#4253)');
    const { api, calls } = makeApi({
      openIssues: [{ number: 55, body: `${marker}\nexisting`, pull_request: undefined }],
    });
    const result = await handleWorkflowFailure({ run: makeRun({ id: '124' }), api, repo: REPO });

    expect(result).toEqual({ action: 'commented', number: 55 });
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/issues'))).toBe(false);
    const comment = calls.find((c) => c.path === `/repos/${REPO}/issues/55/comments`);
    expect(comment.body.body).toContain('Another failure');
  });

  it('keeps separate Issues for different workflows', async () => {
    const otherMarker = exceptionMarker('D1 Migrations');
    const { api } = makeApi({ openIssues: [{ number: 7, body: otherMarker }] });
    const result = await handleWorkflowFailure({ run: makeRun(), api, repo: REPO });

    expect(result.action).toBe('created');
  });

  it('ignores pull requests that happen to carry the marker', async () => {
    const marker = exceptionMarker('OPS — Scheduled Content Publish (#4253)');
    const { api } = makeApi({ openIssues: [{ number: 8, body: marker, pull_request: {} }] });
    const result = await handleWorkflowFailure({ run: makeRun(), api, repo: REPO });

    expect(result.action).toBe('created');
  });

  it('does nothing when the run did not fail', async () => {
    const { api, calls } = makeApi();
    for (const conclusion of ['success', 'cancelled', 'skipped']) {
      const result = await handleWorkflowFailure({ run: makeRun({ conclusion }), api, repo: REPO });
      expect(result).toEqual({ action: 'skipped', reason: 'not_failure' });
    }
    expect(calls).toHaveLength(0);
  });

  it('includes the failing step when jobs are available', async () => {
    const jobs = {
      jobs: [
        {
          name: 'publish-due',
          conclusion: 'failure',
          steps: [
            { name: 'Checkout', conclusion: 'success' },
            { name: 'Run publish-due sweep', conclusion: 'failure' },
          ],
        },
      ],
    };
    const { api, calls } = makeApi({ jobs });
    await handleWorkflowFailure({ run: makeRun(), api, repo: REPO });

    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
    expect(created.body.body).toContain('publish-due / Run publish-due sweep');
  });

  it('still opens the Issue when job details cannot be read', async () => {
    const { api } = makeApi({ jobsError: true });
    const result = await handleWorkflowFailure({ run: makeRun(), api, repo: REPO });

    expect(result.action).toBe('created');
    expect(await getFailedSteps(api, REPO, '123')).toEqual([]);
  });

  it('explains a run with no jobs (for example an invalid workflow file)', () => {
    expect(renderIssueBody(makeRun(), [])).toContain('before any job started');
  });
});
