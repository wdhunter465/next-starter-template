#!/usr/bin/env node
// Halts a scheduled workflow after 3 consecutive failures (#4589, #4637).
// Policy: docs/governance/OPERATIONS-AND-RECOVERY.md, "Repeated Action failure halt".
// Procedure: docs/how-to/ci/workflow-failure-exception-issues.md.
//
// Behavior:
//   - covers workflows whose file has a `schedule:` trigger (never PR, push or workflow_run gates)
//   - looks at the 3 newest completed runs on the default branch; success restarts the count,
//     cancelled/skipped runs are ignored
//   - 3 failures: open one Operations Issue first, then disable the workflow
//   - Production-protecting jobs (ALERT_ONLY) get the Issue but are never disabled
//   - GITHUB_TOKEN only (actions: write to disable, issues: write for the Issue)

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FAILURE_LIMIT = 3;
export const SELF = 'ops-halt-repeated-failures.yml';
// An Operations Issue is an actionable interrupt only when it carries exactly one ops:priority:N
// (docs/governance/WORK-QUEUES-AND-COLLABORATION.md). A halted Action is priority 2; a
// Production-protecting job that keeps failing is priority 1.
export const HALT_LABELS = ['team:operations', 'ops-exception', 'ops-halted', 'ops:priority:2'];
export const ALERT_LABELS = ['team:operations', 'ops-exception', 'ops:priority:1'];

// Jobs that protect Production. Silently stopping them is worse than repeated failure,
// so they alert and keep running. Product Authority confirms this list (#4637).
export const ALERT_ONLY = new Set([
  'ops-d1-backup-scheduled-daily-3268.yml',
  'ops-d1-backup-scheduled-quarterly-drill-3268.yml',
  'snapshot.yml',
  'production-audit.yml',
  'ops-site-uptime-probe.yml',
  'b2-d1-daily-sync.yml',
]);

const COUNTED = new Set(['success', 'failure', 'timed_out']);
const FAILED = new Set(['failure', 'timed_out']);

export function markerFor(file) {
  return `<!-- ops-halt:${file} -->`;
}

// Newest failed run a halt record covers. After a person re-enables the workflow the old
// failures stay in its history, so later sweeps only count runs newer than this id.
export function lastRunMarker(runId) {
  return `<!-- ops-halt-last-run:${runId} -->`;
}

export function findRecord(issues, file) {
  const marker = markerFor(file);
  const match = (issues || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(marker),
  );
  if (!match) return null;
  const seen = match.body.match(/<!-- ops-halt-last-run:(\d+) -->/);
  return { number: match.number, state: match.state, body: match.body, lastRunId: seen ? Number(seen[1]) : 0 };
}

export function isScheduled(text) {
  return /^\s{2}schedule:\s*$/m.test(text) || /^on:\s*\[[^\]]*\bschedule\b/m.test(text);
}

export function listScheduledWorkflows(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name) && name !== SELF)
    .filter((name) => isScheduled(fs.readFileSync(path.join(dir, name), 'utf8')))
    .sort();
}

// runs: newest first, as the Actions API returns them.
export function consecutiveFailures(runs, limit = FAILURE_LIMIT) {
  const failures = [];
  for (const run of runs) {
    if (!COUNTED.has(run.conclusion)) continue;
    if (!FAILED.has(run.conclusion)) break;
    failures.push(run);
    if (failures.length >= limit) break;
  }
  return failures;
}

export function renderHaltBody({ file, name, failures, alertOnly }) {
  const runs = failures.map((run) => `- ${run.html_url} (${run.event}, ${run.created_at})`);
  return [
    markerFor(file),
    lastRunMarker(failures[0].id),
    '',
    alertOnly
      ? `## Alert: ${name} failed ${FAILURE_LIMIT} times in a row (not halted)`
      : `## Halted: ${name} failed ${FAILURE_LIMIT} times in a row`,
    '',
    `- Workflow file: \`.github/workflows/${file}\``,
    `- Failed runs on the default branch:`,
    ...runs,
    '',
    alertOnly
      ? 'This job protects Production, so it keeps running and is not disabled. Operations treats this as a priority exception.'
      : 'The workflow is now disabled and makes no further attempts. It will not add comments or open more Issues until it is re-enabled.',
    '',
    '## Operations next steps',
    '',
    '1. Open the failed runs above and read the failing step.',
    '2. Decide: a real fault (fix it under a source Issue), a missing secret or configuration (record who provisions it), or an accepted state (record the decision).',
    alertOnly
      ? '3. Close this Issue with a comment naming the fix or decision.'
      : `3. Re-enable: Actions tab, \`${name}\`, "Enable workflow" (or \`gh workflow enable ${file}\`). A successful run restarts the failure count.`,
    alertOnly ? '' : '4. Close this Issue with a comment naming the fix or decision.',
    '',
    'Opened automatically (#4637, policy in `docs/governance/OPERATIONS-AND-RECOVERY.md`). It is never closed automatically.',
  ].filter((line) => line !== undefined).join('\n');
}

export async function sweep({ files, api, repo, branch, alertOnly = ALERT_ONLY, log = () => {} }) {
  const outcomes = [];
  // Open and closed records, newest first: the newest one per workflow is its halt record.
  const records = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = (await api('GET', `/repos/${repo}/issues?state=all&labels=${encodeURIComponent('ops-exception')}&per_page=100&page=${page}`)) || [];
    records.push(...batch);
    if (batch.length < 100) break;
  }
  for (const file of files) {
    try {
      outcomes.push(...(await sweepOne({ file, api, repo, branch, alertOnly, log, records })));
    } catch (error) {
      // One workflow's API error must not stop the others from being checked.
      outcomes.push({ file, action: 'error', reason: error.message });
    }
  }
  return outcomes;
}

async function sweepOne({ file, api, repo, branch, alertOnly, log, records }) {
  const outcomes = [];
  let workflow;
  try {
    workflow = await api('GET', `/repos/${repo}/actions/workflows/${file}`);
  } catch (error) {
    outcomes.push({ file, action: 'skipped', reason: `workflow lookup failed: ${error.message}` });
    return outcomes;
  }
  if (workflow.state !== 'active') {
    outcomes.push({ file, action: 'skipped', reason: `state ${workflow.state}` });
    return outcomes;
  }
  let runs;
  try {
    const listed = await api(
      'GET',
      `/repos/${repo}/actions/workflows/${file}/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=10`,
    );
    runs = listed.workflow_runs || [];
  } catch (error) {
    outcomes.push({ file, action: 'skipped', reason: `runs lookup failed: ${error.message}` });
    return outcomes;
  }
  const record = findRecord(records, file);
  const failures = consecutiveFailures(runs.filter((run) => run.id > (record?.lastRunId || 0)));
  if (failures.length < FAILURE_LIMIT) {
    outcomes.push({ file, action: 'ok' });
    return outcomes;
  }

  const isAlertOnly = alertOnly.has(file);
  const existing = record && record.state === 'open' ? record : null;

  if (isAlertOnly) {
    if (existing) {
      outcomes.push({ file, action: 'alert-already-open', number: existing.number });
      return outcomes;
    }
    const created = await api('POST', `/repos/${repo}/issues`, {
      title: `OPS ALERT: ${workflow.name} failed ${FAILURE_LIMIT} times in a row (not halted)`,
      body: renderHaltBody({ file, name: workflow.name, failures, alertOnly: true }),
      labels: ALERT_LABELS,
    });
    outcomes.push({ file, action: 'alerted', number: created.number });
    return outcomes;
  }

  // Report first so a halt is never silent, then stop the attempts.
  let number;
  if (existing) {
    await api('PATCH', `/repos/${repo}/issues/${existing.number}`, {
      body: existing.body.replace(/<!-- ops-halt-last-run:\d+ -->/, lastRunMarker(failures[0].id)),
    });
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, {
      body: `Halted again after ${FAILURE_LIMIT} more consecutive failures:\n${failures.map((run) => `- ${run.html_url}`).join('\n')}`,
    });
    number = existing.number;
  } else {
    const created = await api('POST', `/repos/${repo}/issues`, {
      title: `OPS HALTED: ${workflow.name} halted after ${FAILURE_LIMIT} consecutive failures`,
      body: renderHaltBody({ file, name: workflow.name, failures, alertOnly: false }),
      labels: HALT_LABELS,
    });
    number = created.number;
  }
  try {
    await api('PUT', `/repos/${repo}/actions/workflows/${file}/disable`);
    outcomes.push({ file, action: 'halted', number });
    log(`Halted ${file}; Issue #${number}`);
  } catch (error) {
    await api('POST', `/repos/${repo}/issues/${number}/comments`, {
      body: `Could not disable \`${file}\` (${error.message}). It is still running; Operations should disable it by hand.`,
    });
    outcomes.push({ file, action: 'halt-failed', number, reason: error.message });
  }
  return outcomes;
}

function makeApi(token, { dryRun = false } = {}) {
  return async function api(method, route, body) {
    if (dryRun && method !== 'GET') {
      console.log(`[dry-run] ${method} ${route}${body?.title ? ` — ${body.title}` : ''}`);
      return method === 'POST' && route.endsWith('/issues') ? { number: 0 } : null;
    }
    const response = await fetch(`https://api.github.com${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub API ${method} ${route} failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
  const branch = process.env.DEFAULT_BRANCH || 'main';
  const files = listScheduledWorkflows(path.join(process.cwd(), '.github', 'workflows'));
  const dryRun = process.argv.includes('--dry-run');
  const outcomes = await sweep({ files, api: makeApi(token, { dryRun }), repo, branch, log: (line) => console.log(line) });
  for (const outcome of outcomes) {
    if (outcome.action !== 'ok') console.log(JSON.stringify(outcome));
  }
  console.log(`Checked ${files.length} scheduled workflows; ${outcomes.filter((o) => o.action === 'halted').length} halted, ${outcomes.filter((o) => o.action === 'alerted').length} alerted.`);
  // Halting is the response, not a failure. An API error or a failed halt does fail the run.
  return outcomes.some((o) => o.action === 'error' || o.action === 'halt-failed') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
