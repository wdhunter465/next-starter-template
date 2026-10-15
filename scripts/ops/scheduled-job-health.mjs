#!/usr/bin/env node
// Monitor of monitors (#4468, gap rows 67 and 78). Flags a scheduled workflow that is
// disabled, missing, or has not succeeded on the default branch within its window.
// Immediate per-run failures are the #4444 watcher's job; this catches silence.

import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary, escalateOpsRuntimeFailure } from '../ci/ops_runtime_escalation.mjs';

export const ESCALATION_TITLE = 'OPS — Scheduled job health — stale or disabled job';

const HOUR = 60 * 60 * 1000;

// maxAgeHours: longest acceptable gap since the last successful run on the default
// branch (any trigger). null means only the enabled state is checked.
export const JOBS = [
  { file: 'ops-site-uptime-probe.yml', maxAgeHours: 3 },
  { file: 'ops-stale-communication.yml', maxAgeHours: 3 },
  { file: 'program-2477-chat-attention-pulse.yml', maxAgeHours: 3 },
  { file: 'ops-chatterbox-reconciliation-sweep.yml', maxAgeHours: 4 },
  { file: 'pmo-dashboard-ci-build.yml', maxAgeHours: 4 },
  { file: 'production-audit.yml', maxAgeHours: 26 },
  { file: 'ops-d1-backup-scheduled-daily-3268.yml', maxAgeHours: 30 },
  { file: 'snapshot.yml', maxAgeHours: 30 },
  { file: 'b2-d1-daily-sync.yml', maxAgeHours: 30 },
  { file: 'b2-s3-smoke-test.yml', maxAgeHours: 30 },
  { file: 'ops-assess.yml', maxAgeHours: 30 },
  { file: 'ops-design-compliance-audit.yml', maxAgeHours: 30 },
  { file: 'ops-post-merge-self-healing.yml', maxAgeHours: 30 },
  { file: 'ops-scheduled-content-publish.yml', maxAgeHours: 30 },
  { file: 'lgfc-cursor-runner-health.yml', maxAgeHours: 54 },
  { file: 'ops-asset-register-reconcile.yml', maxAgeHours: 8 * 24 + 6 },
  { file: 'ops-weekly-operations-scorecard.yml', maxAgeHours: 8 * 24 + 6 },
  { file: 'ai-execution-bridge-smoke.yml', maxAgeHours: 8 * 24 + 6 },
  { file: 'gehrig-content-discovery.yml', maxAgeHours: 8 * 24 + 6 },
  { file: 'ops-d1-backup-scheduled-quarterly-drill-3268.yml', maxAgeHours: 95 * 24 },
  { file: 'ops-workflow-failure-exception-issues.yml', maxAgeHours: null },
];

export function evaluateJob(job, { state, lastSuccessAt }, now = new Date()) {
  if (!state) return { ...job, ok: false, reason: 'workflow not found' };
  if (state !== 'active') return { ...job, ok: false, reason: `workflow state is ${state}` };
  if (job.maxAgeHours === null) return { ...job, ok: true, reason: '', lastSuccessAt };
  if (!lastSuccessAt) return { ...job, ok: false, reason: 'no successful run on the default branch' };
  const ageHours = (now.getTime() - new Date(lastSuccessAt).getTime()) / HOUR;
  if (ageHours > job.maxAgeHours) {
    return { ...job, ok: false, lastSuccessAt, reason: `last success ${Math.round(ageHours)} h ago (limit ${job.maxAgeHours} h)` };
  }
  return { ...job, ok: true, lastSuccessAt, reason: '' };
}

export async function fetchJobStatus(job, { repository, headers, branch, fetchImpl = fetch }) {
  const base = `https://api.github.com/repos/${repository}/actions/workflows/${job.file}`;
  const workflow = await fetchImpl(base, { headers });
  if (workflow.status === 404) return { state: null, lastSuccessAt: null };
  if (!workflow.ok) throw new Error(`GET ${job.file} failed: ${workflow.status}`);
  const { state } = await workflow.json();
  const runs = await fetchImpl(`${base}/runs?branch=${encodeURIComponent(branch)}&status=success&per_page=1`, { headers });
  if (!runs.ok) throw new Error(`GET ${job.file} runs failed: ${runs.status}`);
  const latest = (await runs.json()).workflow_runs?.[0];
  return { state, lastSuccessAt: latest?.updated_at || latest?.created_at || null };
}

export async function runCheck(jobs, context, now = new Date()) {
  const results = [];
  for (const job of jobs) results.push(evaluateJob(job, await fetchJobStatus(job, context), now));
  return { ok: results.every((result) => result.ok), results };
}

export function renderReport({ ok, results }, checkedAt = new Date().toISOString()) {
  const lines = [
    '## Scheduled job health',
    '',
    `- Checked at: ${checkedAt}`,
    `- Overall: ${ok ? 'PASS' : 'FAIL'}`,
    '',
    '| Workflow | Limit | Last success | Result |',
    '| --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const limit = result.maxAgeHours === null ? 'enabled only' : `${result.maxAgeHours} h`;
    lines.push(`| ${result.file} | ${limit} | ${result.lastSuccessAt || '-'} | ${result.ok ? 'PASS' : `FAIL — ${result.reason}`} |`);
  }
  return lines.join('\n');
}

export function failingMarker({ results }) {
  const files = results.filter((result) => !result.ok).map((result) => result.file).sort();
  return `<!-- scheduled-job-health:failing=${files.join(',')} -->`;
}

function githubContext() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) return null;
  return {
    repository,
    branch: process.env.DEFAULT_BRANCH || 'main',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-scheduled-job-health',
    },
  };
}

async function findOpenEscalation({ repository, headers }) {
  const listed = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, { headers });
  if (!listed.ok) throw new Error(`list issues failed: ${listed.status}`);
  return (await listed.json()).find((issue) => issue.title === ESCALATION_TITLE && !issue.pull_request) || null;
}

async function commentRecoveryIfOpen(context, report) {
  const { repository, headers } = context;
  const open = await findOpenEscalation(context);
  if (!open) return null;
  const marker = '<!-- scheduled-job-health:recovered -->';
  const comments = await fetch(`https://api.github.com/repos/${repository}/issues/${open.number}/comments?per_page=100`, { headers });
  const existing = comments.ok ? await comments.json() : [];
  if (existing[existing.length - 1]?.body?.includes(marker)) return open.number;
  await fetch(`https://api.github.com/repos/${repository}/issues/${open.number}/comments`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: `${marker}\n## Recovered\n\nEvery scheduled job is enabled and inside its window. Close this Issue once the cause is recorded.\n\n${report}` }),
  });
  return open.number;
}

async function main() {
  const context = githubContext();
  if (!context) throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
  const check = await runCheck(JOBS, context);
  const report = renderReport(check);
  console.log(report);
  appendOpsStepSummary(report);
  if (!process.argv.includes('--escalate')) return check.ok ? 0 : 1;

  if (!check.ok) {
    const marker = failingMarker(check);
    const open = await findOpenEscalation(context);
    if (open?.body?.includes(marker)) {
      console.log(`Same failing jobs already reported on #${open.number}; not re-posting.`);
      return 1;
    }
    const outcome = await escalateOpsRuntimeFailure({
      workflowName: 'OPS — Scheduled Job Health',
      title: ESCALATION_TITLE,
      runUrl: process.env.OPS_ESCALATION_RUN_URL || '',
      details: `${marker}\n${report}`,
      nextSteps: [
        'For each failing row, open the workflow in the Actions tab and read its latest runs.',
        'A disabled workflow: re-enable it, or record why it stays off and remove it from JOBS in scripts/ops/scheduled-job-health.mjs by PR.',
        'Record the cause and recovery evidence here, then close this Issue.',
      ],
      labels: ['ops-runtime-failure', 'team:operations'],
    });
    console.log(JSON.stringify(outcome));
    return 1;
  }
  const recovered = await commentRecoveryIfOpen(context, report);
  if (recovered) console.log(`Recovery recorded on #${recovered}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
