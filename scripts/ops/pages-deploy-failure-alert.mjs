// Opens one Operations Issue when the Cloudflare Pages check fails on the
// default branch (#4689). A successful check opens nothing. A later failure
// comments on the open Issue instead of opening a second one.
//
// A failed D1 Migrations run is already handled by
// scripts/ci/open_workflow_failure_issue.mjs via
// .github/workflows/ops-workflow-failure-exception-issues.yml (#4444).

import { pathToFileURL } from 'node:url';

export const PAGES_CHECK_NAME = 'Cloudflare Pages';
export const PAGES_APP_SLUG = 'cloudflare-workers-and-pages';
export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];
const MARKER = '<!-- ops-pages-deploy-failure -->';

export function selectFailedPagesCheck(checks, { headBranch, defaultBranch }) {
  if (!headBranch || headBranch !== defaultBranch) return null;
  return (
    (checks || []).find(
      (check) => check && check.name === PAGES_CHECK_NAME && check.conclusion === 'failure',
    ) || null
  );
}

export function renderIssueBody({ sha, runUrl, detailsUrl }) {
  const lines = [
    MARKER,
    '',
    '## Exception: Cloudflare Pages deployment failed on the default branch',
    '',
    `- Commit: ${sha}`,
    `- Run: ${runUrl}`,
  ];
  if (detailsUrl) lines.push(`- Cloudflare deployment: ${detailsUrl}`);
  lines.push(
    '',
    '## What this Issue is',
    '',
    'An automatic exception record (#4689). It is assigned to the Operations queue (`team:operations`). A later failure adds a comment instead of opening another Issue. A successful deployment opens nothing. Operations closes this Issue once the cause is fixed or accepted.',
    '',
    'A failed D1 Migrations run on the default branch is opened by the workflow failure watcher (#4444), not by this script.',
  );
  return lines.join('\n');
}

export function renderComment({ sha, runUrl, detailsUrl }) {
  const lines = [`Another failed Pages deployment: ${runUrl}`, '', `- Commit: ${sha}`];
  if (detailsUrl) lines.push(`- Cloudflare deployment: ${detailsUrl}`);
  return lines.join('\n');
}

export async function handlePagesDeployFailure({ checks, headBranch, defaultBranch, sha, api, repo }) {
  const failed = selectFailedPagesCheck(checks, { headBranch, defaultBranch });
  if (!failed) return { action: 'skipped', reason: 'no_failed_pages_check' };

  const runUrl = failed.html_url || failed.details_url || '';
  const open = await api(
    'GET',
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent('ops-exception')}&per_page=100`,
  );
  const existing = (open || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(MARKER),
  );

  if (existing) {
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, {
      body: renderComment({ sha, runUrl, detailsUrl: failed.details_url }),
    });
    return { action: 'commented', number: existing.number };
  }

  const created = await api('POST', `/repos/${repo}/issues`, {
    title: 'OPS EXCEPTION: Cloudflare Pages deployment failed',
    body: renderIssueBody({ sha, runUrl, detailsUrl: failed.details_url }),
    labels: EXCEPTION_LABELS,
  });
  return { action: 'created', number: created.number };
}

function makeApi(token) {
  return async function api(method, path, body) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path} failed: ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  };
}

async function main() {
  const { GH_TOKEN, REPO, SUITE_ID, HEAD_SHA, HEAD_BRANCH, DEFAULT_BRANCH } = process.env;
  if (!GH_TOKEN || !REPO || !SUITE_ID || !HEAD_SHA || !HEAD_BRANCH || !DEFAULT_BRANCH) {
    console.error(
      'Missing required environment: GH_TOKEN, REPO, SUITE_ID, HEAD_SHA, HEAD_BRANCH, DEFAULT_BRANCH',
    );
    process.exit(2);
  }
  const api = makeApi(GH_TOKEN);
  const data = await api('GET', `/repos/${REPO}/check-suites/${SUITE_ID}/check-runs?per_page=100`);
  const result = await handlePagesDeployFailure({
    checks: data.check_runs || [],
    headBranch: HEAD_BRANCH,
    defaultBranch: DEFAULT_BRANCH,
    sha: HEAD_SHA,
    api,
    repo: REPO,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
