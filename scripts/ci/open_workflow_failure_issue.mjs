// Opens (or updates) an exception Issue when a watched workflow fails on the default
// branch (#4444). Product Authority direction, 2026-10-05: a failed scheduled or
// post-merge action must result in a new Issue assigned to team:operations.
//
// Behavior:
//   - one open exception Issue per workflow name (matched by a hidden marker in the body)
//   - the first failure opens the Issue; later failures add a comment with the run link
//   - labels: team:operations (queue ownership) + ops-exception; no agent:* claim
//   - an Issue is never closed automatically; Operations closes it when resolved

import { pathToFileURL } from 'node:url';

export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];
const MARKER_PREFIX = 'ops-exception-workflow:';

export function exceptionTitle(workflowName) {
  return `OPS EXCEPTION: ${workflowName} failed`;
}

export function exceptionMarker(workflowName) {
  return `<!-- ${MARKER_PREFIX}${workflowName} -->`;
}

function describeFailures(failedSteps) {
  if (!failedSteps || failedSteps.length === 0) {
    return 'Failed job or step: not available (the run may have failed before any job started, for example an invalid workflow file).';
  }
  return `Failed job and step: ${failedSteps.map((s) => `${s.job} / ${s.step}`).join('; ')}`;
}

export function renderIssueBody(run, failedSteps) {
  return [
    exceptionMarker(run.name),
    '',
    '## Exception: a watched workflow failed',
    '',
    `- Workflow: ${run.name}`,
    `- First failed run: ${run.url}`,
    `- Trigger: ${run.event}`,
    `- Commit: ${run.sha}`,
    `- ${describeFailures(failedSteps)}`,
    '',
    '## What this Issue is',
    '',
    'An automatic exception record (#4444). It is assigned to the Operations queue (`team:operations`) for immediate review. Later failures of the same workflow add a comment here instead of opening a new Issue. A passing run does not close it; Operations closes it once the cause is fixed or accepted.',
    '',
    '## First checks',
    '',
    '1. Open the failed run and read the failing step.',
    '2. Decide whether it is a real fault (fix it under a source Issue), a missing secret or configuration (record who provisions it), or an accepted state (record the decision).',
    '3. Close this Issue with a comment naming the fix or decision.',
  ].join('\n');
}

export function renderComment(run, failedSteps) {
  return [
    `Another failure: ${run.url}`,
    '',
    `- Trigger: ${run.event}`,
    `- Commit: ${run.sha}`,
    `- ${describeFailures(failedSteps)}`,
  ].join('\n');
}

export async function getFailedSteps(api, repo, runId) {
  try {
    const data = await api('GET', `/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
    const steps = [];
    for (const job of data.jobs || []) {
      if (job.conclusion !== 'failure') continue;
      for (const step of job.steps || []) {
        if (step.conclusion === 'failure') steps.push({ job: job.name, step: step.name });
      }
    }
    return steps;
  } catch {
    return [];
  }
}

export async function handleWorkflowFailure({ run, api, repo }) {
  if (run.conclusion !== 'failure') {
    return { action: 'skipped', reason: 'not_failure' };
  }

  const failedSteps = await getFailedSteps(api, repo, run.id);
  const open = await api(
    'GET',
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent('ops-exception')}&per_page=100`,
  );
  const marker = exceptionMarker(run.name);
  const existing = (open || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(marker),
  );

  if (existing) {
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, {
      body: renderComment(run, failedSteps),
    });
    return { action: 'commented', number: existing.number };
  }

  const created = await api('POST', `/repos/${repo}/issues`, {
    title: exceptionTitle(run.name),
    body: renderIssueBody(run, failedSteps),
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
  const { GH_TOKEN, REPO, RUN_ID, RUN_NAME, RUN_URL, RUN_CONCLUSION, RUN_EVENT, RUN_SHA } = process.env;
  if (!GH_TOKEN || !REPO || !RUN_ID || !RUN_NAME) {
    console.error('Missing required environment: GH_TOKEN, REPO, RUN_ID, RUN_NAME');
    process.exit(2);
  }
  const result = await handleWorkflowFailure({
    run: {
      id: RUN_ID,
      name: RUN_NAME,
      url: RUN_URL,
      conclusion: RUN_CONCLUSION,
      event: RUN_EVENT,
      sha: RUN_SHA,
    },
    api: makeApi(GH_TOKEN),
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
