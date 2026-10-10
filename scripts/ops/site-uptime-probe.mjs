#!/usr/bin/env node
// Scheduled uptime probe for the production site (#4540). Public URLs only; no credentials.

import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary, escalateOpsRuntimeFailure } from '../ci/ops_runtime_escalation.mjs';

export const ESCALATION_TITLE = 'OPS — Site uptime probe — failure detected';

export const DEFAULT_TARGETS = [
  { name: 'home (www)', url: 'https://www.lougehrigfanclub.com/' },
  { name: 'faq (www)', url: 'https://www.lougehrigfanclub.com/faq/' },
  { name: 'api health + D1', url: 'https://www.lougehrigfanclub.com/api/health', expectJson: { ok: true, db_ok: true } },
  { name: 'pages.dev host', url: 'https://next-starter-template-6yr.pages.dev/' },
  { name: 'apex domain', url: 'https://lougehrigfanclub.com/' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkOnce(target, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const started = Date.now();
  try {
    const response = await fetchImpl(target.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'lgfc-site-uptime-probe' },
    });
    const elapsedMs = Date.now() - started;
    if (response.status < 200 || response.status > 299) {
      return { ok: false, status: response.status, elapsedMs, reason: `HTTP ${response.status}` };
    }
    if (target.expectJson) {
      let body;
      try {
        body = await response.json();
      } catch {
        return { ok: false, status: response.status, elapsedMs, reason: 'response is not JSON' };
      }
      for (const [key, expected] of Object.entries(target.expectJson)) {
        if (body?.[key] !== expected) {
          return { ok: false, status: response.status, elapsedMs, reason: `${key} is ${JSON.stringify(body?.[key])}, expected ${JSON.stringify(expected)}` };
        }
      }
    }
    return { ok: true, status: response.status, elapsedMs, reason: '' };
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { ok: false, status: 0, elapsedMs: Date.now() - started, reason: timedOut ? `timeout after ${timeoutMs} ms` : String(error?.message || error) };
  }
}

export async function checkTarget(target, { attempts = 2, retryDelayMs = 10_000, ...options } = {}) {
  const tries = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await checkOnce(target, options);
    tries.push(result);
    if (result.ok) break;
    if (attempt < attempts) await sleep(retryDelayMs);
  }
  const last = tries[tries.length - 1];
  return { ...target, ok: last.ok, status: last.status, reason: last.reason, attempts: tries.length };
}

export async function runProbe(targets = DEFAULT_TARGETS, options = {}) {
  const results = [];
  for (const target of targets) results.push(await checkTarget(target, options));
  return { ok: results.every((result) => result.ok), results };
}

export function renderReport({ ok, results }, checkedAt = new Date().toISOString()) {
  const lines = [
    '## Site uptime probe',
    '',
    `- Checked at: ${checkedAt}`,
    `- Overall: ${ok ? 'PASS' : 'FAIL'}`,
    '',
    '| Target | URL | Result | Attempts |',
    '| --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const outcome = result.ok ? `PASS (HTTP ${result.status})` : `FAIL — ${result.reason}`;
    lines.push(`| ${result.name} | ${result.url} | ${outcome} | ${result.attempts} |`);
  }
  return lines.join('\n');
}

export function failingMarker({ results }) {
  const names = results.filter((result) => !result.ok).map((result) => result.name).sort();
  return `<!-- site-uptime-probe:failing=${names.join(',')} -->`;
}

function githubContext() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) return null;
  return {
    repository,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-site-uptime-probe',
    },
  };
}

async function findOpenEscalation({ repository, headers }) {
  const listed = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, { headers });
  if (!listed.ok) throw new Error(`list issues failed: ${listed.status}`);
  return (await listed.json()).find((issue) => issue.title === ESCALATION_TITLE && !issue.pull_request) || null;
}

async function commentRecoveryIfOpen(report) {
  const context = githubContext();
  if (!context) return null;
  const { repository, headers } = context;
  const open = await findOpenEscalation(context);
  if (!open) return null;
  const marker = '<!-- site-uptime-probe:recovered -->';
  const comments = await fetch(`https://api.github.com/repos/${repository}/issues/${open.number}/comments?per_page=100`, { headers });
  const existing = comments.ok ? await comments.json() : [];
  const latest = existing[existing.length - 1];
  if (latest?.body?.includes(marker)) return open.number;
  await fetch(`https://api.github.com/repos/${repository}/issues/${open.number}/comments`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: `${marker}\n## Recovered\n\nAll probe targets passed. Close this Issue once recovery is confirmed.\n\n${report}` }),
  });
  return open.number;
}

async function main() {
  const probe = await runProbe();
  const report = renderReport(probe);
  console.log(report);
  appendOpsStepSummary(report);
  if (!process.argv.includes('--escalate')) return probe.ok ? 0 : 1;

  if (!probe.ok) {
    const marker = failingMarker(probe);
    const context = githubContext();
    const open = context ? await findOpenEscalation(context) : null;
    if (open?.body?.includes(marker)) {
      console.log(`Same failing targets already reported on #${open.number}; not re-posting.`);
      return 1;
    }
    const outcome = await escalateOpsRuntimeFailure({
      workflowName: 'OPS — Site uptime probe',
      title: ESCALATION_TITLE,
      runUrl: process.env.OPS_ESCALATION_RUN_URL || '',
      details: `${marker}\n${report}`,
      nextSteps: [
        'Check the Cloudflare Pages deployment and the failing host in the Cloudflare dashboard.',
        'Record the cause and recovery evidence here, then close this Issue.',
      ],
      labels: ['ops-runtime-failure', 'team:operations'],
    });
    console.log(JSON.stringify(outcome));
    return 1;
  }
  const recovered = await commentRecoveryIfOpen(report);
  if (recovered) console.log(`Recovery recorded on #${recovered}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
