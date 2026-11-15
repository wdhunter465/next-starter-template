// Opens (or updates) an exception Issue when a watched workflow fails on the default
// branch (#4444). Product Authority direction, 2026-10-05: a failed scheduled or
// post-merge action must result in a new Issue assigned to team:operations.
//
// Behavior:
//   - one open exception Issue per workflow name (matched by a hidden marker in the body)
//   - the first failure opens the Issue; later failures add a comment with the run link
//   - labels: team:operations (queue ownership) + ops-exception; no agent:* claim
//   - an Issue is never closed automatically; Operations closes it when resolved
//   - #4681 (decision 2): a failed run of a read-only monitor is re-run once before any Issue opens. If the re-run
//     fails, or could not be requested, the Issue opens as before. Workflows that write (backups, publishing,
//     syncs, migrations) are never re-run automatically.

import { pathToFileURL } from 'node:url';

export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];

// Read-only monitors only. Re-running a job that writes (D1 backup, content publish, B2 sync, migrations, snapshot)
// could repeat a side effect, so none of those are here. Names are the workflow `name:` values.
export const RERUN_ONCE_WORKFLOWS = [
  'Repository Runner Health',
  'LGFC Cursor Runner Health',
  'OPS — Production Edge Health',
  'OPS — Scheduled Job Health',
  'OPS — Matchup Pair Monitor',
  'OPS — Design Compliance Audit',
];

/** True for the first attempt of a scheduled run of a read-only monitor. Undefined or later attempts never qualify. */
export function shouldRerunOnce(run) {
  return (
    run?.event === 'schedule' &&
    Number(run?.attempt) === 1 &&
    RERUN_ONCE_WORKFLOWS.includes(run?.name)
  );
}

function describeRerun(run) {
  if (run.rerun_error) {
    return `Automatic re-run: could not be requested (${run.rerun_error}); this Issue opened on the first failure.`;
  }
  if (Number(run.attempt) >= 2 && RERUN_ONCE_WORKFLOWS.includes(run.name)) {
    return 'Automatic re-run: this run was re-run once and failed again.';
  }
  return null;
}
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
    ...(describeRerun(run) ? [`- ${describeRerun(run)}`] : []),
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
    ...(describeRerun(run) ? [`- ${describeRerun(run)}`] : []),
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

  if (shouldRerunOnce(run)) {
    try {
      await api('POST', `/repos/${repo}/actions/runs/${run.id}/rerun-failed-jobs`);
      return { action: 'rerun_requested', attempt: 1 };
    } catch (error) {
      // A failure is never hidden: if the re-run cannot be requested, the Issue opens now.
      run = { ...run, rerun_error: error instanceof Error ? error.message : String(error) };
    }
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
  const { GH_TOKEN, REPO, RUN_ID, RUN_NAME, RUN_URL, RUN_CONCLUSION, RUN_EVENT, RUN_SHA, RUN_ATTEMPT } = process.env;
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
      attempt: RUN_ATTEMPT ? Number(RUN_ATTEMPT) : undefined,
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
