#!/usr/bin/env node
// Weekly operations scorecard (#4599). Read-only. One markdown report for the
// last 7 days, from GitHub Actions runs, pull requests, and Issues. No
// Production writes and no new credentials.

import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary } from '../ci/ops_runtime_escalation.mjs';
import { JOBS, fetchJobStatus, runCheck } from './scheduled-job-health.mjs';

export const SCORECARD_TITLE = 'Weekly scorecard';
export const UPTIME_WORKFLOW = 'ops-site-uptime-probe.yml';
export const BACKUP_WORKFLOW = 'ops-d1-backup-scheduled-daily-3268.yml';
const MONITOR_LABELS = new Set(['ops-exception', 'ops-runtime-failure']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function weekWindow(now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getTime() - WEEK_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function ragUptime(percent) {
  if (percent == null) return 'red';
  if (percent >= 99.5) return 'green';
  if (percent >= 98) return 'amber';
  return 'red';
}

export function ragFailedJobs(count) {
  if (count <= 0) return 'green';
  if (count === 1) return 'amber';
  return 'red';
}

export function ragFirstPass(percent) {
  if (percent == null) return 'green';
  if (percent >= 90) return 'green';
  if (percent >= 75) return 'amber';
  return 'red';
}

export function ragHours(hours, greenUnder, amberUntil) {
  if (hours == null) return 'green';
  if (hours < greenUnder) return 'green';
  if (hours <= amberUntil) return 'amber';
  return 'red';
}

export function ragQueue(openCount, oldestHours) {
  if (openCount <= 0) return 'green';
  if (openCount <= 3 && oldestHours <= 24) return 'amber';
  return 'red';
}

export function ragBackupAge(hours) {
  if (hours == null) return 'red';
  if (hours < 30) return 'green';
  if (hours <= 48) return 'amber';
  return 'red';
}

export function uptimeFromRuns(runs) {
  const finished = (runs || []).filter((run) => run.conclusion === 'success' || run.conclusion === 'failure');
  if (finished.length === 0) return { samples: 0, percent: null };
  const successes = finished.filter((run) => run.conclusion === 'success').length;
  return { samples: finished.length, percent: (successes / finished.length) * 100 };
}

export function firstPassRate(pulls) {
  const merged = pulls || [];
  if (merged.length === 0) return { merged: 0, percent: null };
  const passed = merged.filter((pull) => pull.firstPass).length;
  return { merged: merged.length, percent: (passed / merged.length) * 100 };
}

function hoursBetween(start, end) {
  return (new Date(end).getTime() - new Date(start).getTime()) / HOUR_MS;
}

export function restoreHours(closed, stillOpen, now) {
  const durations = [
    ...(closed || []).map((issue) => hoursBetween(issue.createdAt, issue.closedAt)),
    ...(stillOpen || []).map((issue) => hoursBetween(issue.createdAt, now)),
  ];
  if (durations.length === 0) return { count: 0, open: (stillOpen || []).length, worstHours: null };
  return { count: (closed || []).length, open: (stillOpen || []).length, worstHours: Math.max(...durations) };
}

export function openedSplit(issues) {
  const list = issues || [];
  const monitored = list.filter((issue) => issue.monitored).length;
  return { total: list.length, monitored, person: list.length - monitored };
}

export function queueSnapshot(openIssues, now) {
  const list = openIssues || [];
  if (list.length === 0) return { open: 0, oldestHours: 0 };
  const oldestHours = Math.max(...list.map((issue) => hoursBetween(issue.createdAt, now)));
  return { open: list.length, oldestHours };
}

export function buildScorecard(facts, now = new Date()) {
  const window = facts.window || weekWindow(now);
  const uptime = uptimeFromRuns(facts.uptimeRuns);
  const failedJobs = facts.failedJobCount ?? 0;
  const firstPass = firstPassRate(facts.mergedPulls);
  const restore = restoreHours(facts.closedOutages, facts.openOutages, now);
  const opened = openedSplit(facts.openedOpsIssues);
  const queue = queueSnapshot(facts.openOpsIssues, now);
  const backupAgeHours = facts.backupAgeHours ?? null;
  const blockers = facts.priorityOneProjects || [];
  return {
    window,
    rows: [
      {
        name: 'Website uptime (www and apex)',
        value: uptime.percent == null ? 'no samples' : `${uptime.percent.toFixed(1)}% of ${uptime.samples} probe runs`,
        rag: ragUptime(uptime.percent),
      },
      {
        name: 'Failed scheduled jobs now',
        value: String(failedJobs),
        rag: ragFailedJobs(failedJobs),
      },
      {
        name: 'PRs merged, and CI first-pass rate',
        value: firstPass.merged === 0 ? 'no merges' : `${firstPass.merged} merged, ${firstPass.percent.toFixed(1)}% first-pass`,
        rag: ragFirstPass(firstPass.percent),
      },
      {
        name: 'Time to restore after an outage',
        value: restore.worstHours == null ? 'none' : `${restore.worstHours.toFixed(1)} h worst (${restore.count} closed, ${restore.open} still open)`,
        rag: ragHours(restore.worstHours, 24, 72),
      },
      {
        name: 'Ops issues opened',
        value: `${opened.total} (monitoring ${opened.monitored}, person ${opened.person})`,
        rag: '—',
      },
      {
        name: 'Operations queue',
        value: queue.open === 0 ? '0 open' : `${queue.open} open, oldest ${queue.oldestHours.toFixed(1)} h`,
        rag: ragQueue(queue.open, queue.oldestHours),
      },
      {
        name: 'Latest D1 backup age',
        value: backupAgeHours == null ? 'no successful backup' : `${backupAgeHours.toFixed(1)} h`,
        rag: ragBackupAge(backupAgeHours),
      },
      {
        name: 'Open Priority 1 project blockers',
        value: blockers.length === 0 ? 'none' : blockers.map((item) => `#${item.number} ${item.title}`).join('; '),
        rag: '—',
      },
    ],
  };
}

export function weekMarker(window) {
  return `<!-- weekly-scorecard:${window.start.slice(0, 10)}/${window.end.slice(0, 10)} -->`;
}

export function renderScorecard(card) {
  const lines = [
    weekMarker(card.window),
    '## Weekly operations scorecard',
    '',
    `- Week: ${card.window.start} to ${card.window.end}`,
    '- Sources: uptime probe runs (one run checks www and apex together), scheduled-job health, merged pull requests and their check runs, ops issue open and close times, the open Operations queue, the daily D1 backup workflow, open `pmo:priority:1` projects.',
    '',
    '| Row | Value | RAG |',
    '| --- | --- | --- |',
  ];
  for (const row of card.rows) lines.push(`| ${row.name} | ${row.value} | ${row.rag} |`);
  return `${lines.join('\n')}\n`;
}

function nextPage(response) {
  const link = typeof response.headers?.get === 'function' ? response.headers.get('link') || '' : '';
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function getJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  const body = await response.json();
  return { body, next: nextPage(response) };
}

async function listRuns(context, file, window) {
  const runs = [];
  let url = `https://api.github.com/repos/${context.repository}/actions/workflows/${file}/runs?created=${encodeURIComponent(`${window.start}..${window.end}`)}&per_page=100`;
  while (url) {
    const page = await getJson(context.fetchImpl, url, context.headers);
    runs.push(...(page.body.workflow_runs || []));
    url = page.next;
  }
  return runs;
}

async function searchIssues(context, query) {
  const issues = [];
  let url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100`;
  while (url) {
    const page = await getJson(context.fetchImpl, url, context.headers);
    issues.push(...(page.body.items || []).filter((item) => !item.pull_request));
    url = page.next;
  }
  return issues;
}

function labelNames(issue) {
  return (issue.labels || []).map((label) => (typeof label === 'string' ? label : label.name));
}

function isMonitored(issue) {
  return labelNames(issue).some((name) => MONITOR_LABELS.has(name));
}

async function mergedPulls(context, window) {
  const pulls = [];
  let url = `https://api.github.com/repos/${context.repository}/pulls?state=closed&sort=updated&direction=desc&per_page=100`;
  for (let page = 0; url && page < 5; page += 1) {
    const result = await getJson(context.fetchImpl, url, context.headers);
    const batch = result.body || [];
    let olderThanWindow = false;
    for (const pull of batch) {
      if (pull.updated_at && pull.updated_at < window.start) olderThanWindow = true;
      if (pull.merged_at && pull.merged_at >= window.start && pull.merged_at <= window.end) pulls.push(pull);
    }
    if (olderThanWindow) break;
    url = result.next;
  }
  const withChecks = [];
  for (const pull of pulls) {
    const sha = pull.merge_commit_sha || pull.head?.sha;
    const checks = await getJson(
      context.fetchImpl,
      `https://api.github.com/repos/${context.repository}/commits/${sha}/check-runs?per_page=100`,
      context.headers,
    );
    const runs = checks.body.check_runs || [];
    const firstPass = runs.length > 0 && runs.every((run) => run.conclusion !== 'failure' && run.conclusion !== 'timed_out');
    withChecks.push({ number: pull.number, firstPass });
  }
  return withChecks;
}

export async function collectFacts(context, now = new Date(), { jobCheck } = {}) {
  const window = weekWindow(now);
  const repo = context.repository;
  const [uptimeRuns, backup, health, pulls, opened, queue, closedRuntime, closedException, openRuntime, openException, projects] = await Promise.all([
    listRuns(context, UPTIME_WORKFLOW, window),
    fetchJobStatus({ file: BACKUP_WORKFLOW }, context),
    (jobCheck || ((ctx) => runCheck(JOBS, ctx, now)))(context),
    mergedPulls(context, window),
    searchIssues(context, `repo:${repo} is:issue label:team:operations created:${window.start}..${window.end}`),
    searchIssues(context, `repo:${repo} is:issue is:open label:team:operations`),
    searchIssues(context, `repo:${repo} is:issue is:closed label:ops-runtime-failure closed:${window.start}..${window.end}`),
    searchIssues(context, `repo:${repo} is:issue is:closed label:ops-exception closed:${window.start}..${window.end}`),
    searchIssues(context, `repo:${repo} is:issue is:open label:ops-runtime-failure`),
    searchIssues(context, `repo:${repo} is:issue is:open label:ops-exception`),
    searchIssues(context, `repo:${repo} is:issue is:open label:pmo:priority:1 label:pmo:parent`),
  ]);
  const backupAgeHours = backup.lastSuccessAt ? (now.getTime() - new Date(backup.lastSuccessAt).getTime()) / HOUR_MS : null;
  const seen = new Set();
  const closedOutages = [];
  for (const issue of [...closedRuntime, ...closedException]) {
    if (seen.has(issue.number) || !issue.closed_at) continue;
    seen.add(issue.number);
    closedOutages.push({ createdAt: issue.created_at, closedAt: issue.closed_at });
  }
  const openSeen = new Set();
  const openOutages = [];
  for (const issue of [...openRuntime, ...openException]) {
    if (openSeen.has(issue.number)) continue;
    openSeen.add(issue.number);
    openOutages.push({ createdAt: issue.created_at });
  }
  return {
    window,
    uptimeRuns,
    failedJobCount: (health.results || []).filter((result) => !result.ok).length,
    mergedPulls: pulls,
    closedOutages,
    openOutages,
    openedOpsIssues: opened.map((issue) => ({ monitored: isMonitored(issue) })),
    openOpsIssues: queue.map((issue) => ({ createdAt: issue.created_at })),
    backupAgeHours,
    priorityOneProjects: projects.map((issue) => ({ number: issue.number, title: issue.title })),
  };
}

function githubContext() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template';
  if (!token) return null;
  return {
    repository,
    branch: process.env.DEFAULT_BRANCH || 'main',
    fetchImpl: fetch,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-weekly-operations-scorecard',
    },
  };
}

async function publishScorecard(context, report, window) {
  const { repository, headers, fetchImpl } = context;
  const marker = weekMarker(window);
  const listed = await getJson(
    fetchImpl,
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${repository} is:issue in:title "${SCORECARD_TITLE}"`)}&per_page=20`,
    headers,
  );
  let issue = (listed.body.items || []).find((item) => item.title === SCORECARD_TITLE && !item.pull_request);
  if (!issue) {
    const created = await fetchImpl(`https://api.github.com/repos/${repository}/issues`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: SCORECARD_TITLE,
        body: 'Standing weekly operations scorecard (#4599). Each week updates one comment so the history stays on this Issue.',
      }),
    });
    if (!created.ok) throw new Error(`create scorecard issue failed: ${created.status}`);
    issue = await created.json();
  }
  const comments = await getJson(fetchImpl, `https://api.github.com/repos/${repository}/issues/${issue.number}/comments?per_page=100`, headers);
  const existing = (comments.body || []).find((comment) => typeof comment.body === 'string' && comment.body.includes(marker));
  if (existing) {
    const updated = await fetchImpl(`https://api.github.com/repos/${repository}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: report }),
    });
    if (!updated.ok) throw new Error(`update scorecard comment failed: ${updated.status}`);
  } else {
    const posted = await fetchImpl(`https://api.github.com/repos/${repository}/issues/${issue.number}/comments`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: report }),
    });
    if (!posted.ok) throw new Error(`post scorecard comment failed: ${posted.status}`);
  }
  return issue.number;
}

async function main() {
  const context = githubContext();
  if (!context) throw new Error('GITHUB_TOKEN or GH_TOKEN is required.');
  const now = new Date();
  const facts = await collectFacts(context, now);
  const card = buildScorecard(facts, now);
  const report = renderScorecard(card);
  console.log(report);
  appendOpsStepSummary(report);
  if (process.argv.includes('--publish')) {
    const number = await publishScorecard(context, report, card.window);
    console.log(`Scorecard recorded on #${number}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
