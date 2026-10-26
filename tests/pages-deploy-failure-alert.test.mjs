import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  EXCEPTION_LABELS,
  handlePagesDeployFailure,
  selectFailedPagesCheck,
} from '../scripts/ops/pages-deploy-failure-alert.mjs';

const REPO = 'wdhunter465/next-starter-template';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function pagesCheck(conclusion, extras = {}) {
  return {
    name: 'Cloudflare Pages',
    conclusion,
    html_url: 'https://github.com/wdhunter465/next-starter-template/runs/99',
    details_url: 'https://dash.cloudflare.com/pages/deployment/99',
    ...extras,
  };
}

function makeApi({ openIssues = [] } = {}) {
  const calls = [];
  const api = async (method, pathName, body) => {
    calls.push({ method, path: pathName, body });
    if (method === 'GET' && pathName.includes('/issues?')) return openIssues;
    if (method === 'POST' && pathName.endsWith('/issues')) return { number: 901 };
    if (method === 'POST' && pathName.endsWith('/comments')) return { id: 1 };
    throw new Error(`Unexpected call ${method} ${pathName}`);
  };
  return { api, calls };
}

describe('Pages deploy failure alert (#4689)', () => {
  it('opens one Operations Issue for a failed Pages check on the default branch', async () => {
    const { api, calls } = makeApi();
    const result = await handlePagesDeployFailure({
      checks: [pagesCheck('failure')],
      headBranch: 'main',
      defaultBranch: 'main',
      sha: 'abc1234',
      api,
      repo: REPO,
    });

    expect(result).toEqual({ action: 'created', number: 901 });
    const created = calls.find((call) => call.method === 'POST' && call.path.endsWith('/issues'));
    expect(created.body.title).toBe('OPS EXCEPTION: Cloudflare Pages deployment failed');
    expect(created.body.labels).toEqual(EXCEPTION_LABELS);
    expect(created.body.labels.some((label) => label.startsWith('agent:'))).toBe(false);
    expect(created.body.body).toContain('abc1234');
    expect(created.body.body).toContain('https://github.com/wdhunter465/next-starter-template/runs/99');
    expect(created.body.body).toContain('<!-- ops-pages-deploy-failure -->');
  });

  it('opens nothing when the Pages check succeeds', async () => {
    const { api, calls } = makeApi();
    const result = await handlePagesDeployFailure({
      checks: [pagesCheck('success')],
      headBranch: 'main',
      defaultBranch: 'main',
      sha: 'abc1234',
      api,
      repo: REPO,
    });

    expect(result).toEqual({ action: 'skipped', reason: 'no_failed_pages_check' });
    expect(selectFailedPagesCheck([pagesCheck('success')], { headBranch: 'main', defaultBranch: 'main' })).toBeNull();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('ignores a failed Pages check on a pull request branch', async () => {
    const { api, calls } = makeApi();
    const result = await handlePagesDeployFailure({
      checks: [pagesCheck('failure')],
      headBranch: 'cursor/example',
      defaultBranch: 'main',
      sha: 'abc1234',
      api,
      repo: REPO,
    });

    expect(result.action).toBe('skipped');
    expect(calls).toEqual([]);
  });

  it('comments on the open Issue instead of opening a second one', async () => {
    const { api, calls } = makeApi({
      openIssues: [{ number: 70, body: '<!-- ops-pages-deploy-failure -->\nexisting' }],
    });
    const result = await handlePagesDeployFailure({
      checks: [pagesCheck('failure', { html_url: 'https://github.com/wdhunter465/next-starter-template/runs/100' })],
      headBranch: 'main',
      defaultBranch: 'main',
      sha: 'def5678',
      api,
      repo: REPO,
    });

    expect(result).toEqual({ action: 'commented', number: 70 });
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/issues'))).toBe(false);
    const comment = calls.find((call) => call.path === `/repos/${REPO}/issues/70/comments`);
    expect(comment.body.body).toContain('def5678');
    expect(comment.body.body).toContain('/runs/100');
  });

  it('keeps a failed D1 Migrations run on the existing watcher', () => {
    const watcher = readFileSync(
      path.join(ROOT, '.github/workflows/ops-workflow-failure-exception-issues.yml'),
      'utf8',
    );
    expect(watcher).toContain('- "D1 Migrations"');
    const pagesWorkflow = readFileSync(
      path.join(ROOT, '.github/workflows/ops-pages-deploy-failure.yml'),
      'utf8',
    );
    expect(pagesWorkflow).toContain('check_suite:');
    expect(pagesWorkflow).toContain("conclusion == 'failure'");
    expect(pagesWorkflow).not.toContain('open_workflow_failure_issue');
  });
});
