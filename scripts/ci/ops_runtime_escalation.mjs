import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const OPS_RUNTIME_ESCALATION_MARKER = '<!-- ops-runtime-escalation -->';
export const DEFAULT_OPS_RUNTIME_LABEL = 'ops-runtime-failure';

export function buildOpsRuntimeEscalationBody({
  workflowName = 'unknown workflow',
  runUrl = '',
  commitSha = '',
  details = '',
  nextSteps = [],
  retryEvidence = '',
} = {}) {
  const lines = [
    OPS_RUNTIME_ESCALATION_MARKER,
    '',
    '## OPS runtime failure',
    '',
    `- Workflow: ${workflowName}`,
    `- Run: ${runUrl || 'unknown'}`,
    `- Commit: ${commitSha || 'unknown'}`,
  ];

  if (retryEvidence) {
    lines.push('', '## Retry evidence', retryEvidence);
  }

  lines.push('', '## Failure details', details || '- See workflow logs and uploaded artifacts.');

  lines.push('', '## Required action');
  if (nextSteps.length) {
    for (const step of nextSteps) lines.push(`- ${step}`);
  } else {
    lines.push('- Review workflow logs and artifacts.');
    lines.push('- Open a corrective PR if production/runtime behavior regressed.');
    lines.push('- Close this issue after recovery evidence is recorded.');
  }

  return lines.join('\n');
}

export function escalationTitle({ workflowName = 'OPS runtime', suffix = 'failure detected' } = {}) {
  return `${workflowName} — ${suffix}`;
}

async function request(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-ops-runtime-escalation',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * Finds an open issue with an exact title match, using the Search Issues
 * API rather than listing open issues by `per_page=100` — a plain list call
 * only ever sees the first page, so on a repository with more than 100 open
 * issues (this one currently has ~177) a title created earlier can silently
 * fall off page 1 as newer issues accumulate, breaking dedup and letting
 * every caller of `upsertOpsRuntimeIssue` create duplicate issues instead of
 * reusing the existing one. Search indexes the whole repository regardless
 * of open-issue count, at the cost of a short (typically sub-minute) index
 * lag versus a direct list read — an acceptable tradeoff for hourly-or-less
 * dedup checks. The `in:title` search qualifier does substring/tokenized
 * matching, not exact matching, so this still verifies exact title equality
 * client-side before returning a match.
 */
export async function findOpenIssueByTitle({ token, owner, repo, title, requestImpl = request }) {
  const query = `repo:${owner}/${repo} is:issue is:open in:title "${title}"`;
  const params = new URLSearchParams({ q: query, per_page: '20' });
  const result = await requestImpl(`/search/issues?${params.toString()}`, token);
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.find((issue) => issue.title === title && !issue.pull_request);
}

export async function upsertOpsRuntimeIssue({
  token,
  owner,
  repo,
  title,
  body,
  labels = [DEFAULT_OPS_RUNTIME_LABEL],
  findOpen = findOpenIssueByTitle,
  requestImpl = request,
}) {
  const existing = await findOpen({ token, owner, repo, title });

  if (existing?.number) {
    await requestImpl(`/repos/${owner}/${repo}/issues/${existing.number}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
    await requestImpl(`/repos/${owner}/${repo}/issues/${existing.number}/comments`, token, {
      method: 'POST',
      body: JSON.stringify({ body: `Updated escalation evidence at ${new Date().toISOString()}\n\n${body}` }),
    });
    return { action: 'updated', issue: existing.html_url || `#${existing.number}` };
  }

  const created = await requestImpl(`/repos/${owner}/${repo}/issues`, token, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  });

  return { action: 'created', issue: created.html_url || `#${created.number}` };
}

export async function escalateOpsRuntimeFailure(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = options.repository || process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
  }

  const [owner, repo] = repository.split('/');
  const workflowName = options.workflowName || process.env.OPS_ESCALATION_WORKFLOW || 'OPS runtime workflow';
  const title = options.title || escalationTitle({ workflowName });
  const body = buildOpsRuntimeEscalationBody({
    workflowName,
    runUrl: options.runUrl || process.env.OPS_ESCALATION_RUN_URL || '',
    commitSha: options.commitSha || process.env.GITHUB_SHA || '',
    details: options.details || process.env.OPS_ESCALATION_DETAILS || '',
    nextSteps: options.nextSteps || (process.env.OPS_ESCALATION_NEXT_STEPS || '').split('|').filter(Boolean),
    retryEvidence: options.retryEvidence || process.env.OPS_ESCALATION_RETRY_EVIDENCE || '',
  });
  const labels = options.labels || (process.env.OPS_ESCALATION_LABELS || DEFAULT_OPS_RUNTIME_LABEL).split(',').filter(Boolean);

  return upsertOpsRuntimeIssue({ token, owner, repo, title, body, labels });
}

export function appendOpsStepSummary(markdown, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `\n${markdown}\n`);
}

async function main() {
  const outcome = await escalateOpsRuntimeFailure();
  appendOpsStepSummary(`### OPS runtime escalation\n- Action: ${outcome.action}\n- Issue: ${outcome.issue}`);
  console.log(JSON.stringify(outcome, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
