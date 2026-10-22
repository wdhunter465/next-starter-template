#!/usr/bin/env node
// Read-only Production edge check (#4468, gap rows 18, 65, and 78).
// Public HTML only. No credentials and no Production writes.
// Also notices when scheduled-job health itself has gone silent.

import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary, escalateOpsRuntimeFailure } from '../ci/ops_runtime_escalation.mjs';
import { runCheck } from './scheduled-job-health.mjs';

export const ESCALATION_TITLE = 'OPS — Production edge health — check failed';
export const BASELINE_MS = 8000;
export const STALE_MAX_AGE_SECONDS = 24 * 60 * 60;

export const ROUTES = [
  { name: 'home', url: 'https://www.lougehrigfanclub.com/' },
  { name: 'faq', url: 'https://www.lougehrigfanclub.com/faq/' },
];

export const LIVENESS_JOBS = [
  { file: 'ops-scheduled-job-health.yml', maxAgeHours: 6 },
];

export function assessCacheControl(header) {
  if (!header || !String(header).trim()) {
    return { ok: false, reason: 'cache-control header is missing' };
  }
  const value = String(header).toLowerCase();
  const match = value.match(/max-age=(\d+)/);
  const maxAge = match ? Number(match[1]) : null;
  const revalidates = value.includes('must-revalidate') || value.includes('no-cache') || value.includes('no-store');
  if (maxAge !== null && maxAge > STALE_MAX_AGE_SECONDS && !revalidates) {
    return { ok: false, reason: `cache-control allows stale content (${header})` };
  }
  if (maxAge === null && !revalidates) {
    return { ok: false, reason: `cache-control has no max-age or revalidation (${header})` };
  }
  return { ok: true, reason: '' };
}

export function judgeRoute({ name, url, status, cacheControl, elapsedMs, baselineMs = BASELINE_MS }) {
  const base = { name, url, status, cacheControl: cacheControl || '', elapsedMs };
  if (status < 200 || status > 299) {
    return { ...base, ok: false, reason: `HTTP ${status}` };
  }
  const cache = assessCacheControl(cacheControl);
  if (!cache.ok) return { ...base, ok: false, reason: cache.reason };
  if (elapsedMs > baselineMs) {
    return { ...base, ok: false, reason: `response took ${elapsedMs} ms (baseline ${baselineMs} ms)` };
  }
  return { ...base, ok: true, reason: '' };
}

export async function checkRoute(route, { fetchImpl = fetch, baselineMs = BASELINE_MS, timeoutMs = 15_000 } = {}) {
  const started = Date.now();
  try {
    const response = await fetchImpl(route.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'lgfc-production-edge-health' },
    });
    return judgeRoute({
      name: route.name,
      url: route.url,
      status: response.status,
      cacheControl: response.headers?.get?.('cache-control') || '',
      elapsedMs: Date.now() - started,
      baselineMs,
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      name: route.name,
      url: route.url,
      status: 0,
      cacheControl: '',
      elapsedMs: Date.now() - started,
      ok: false,
      reason: timedOut ? `timeout after ${timeoutMs} ms` : String(error?.message || error),
    };
  }
}

export async function runEdgeChecks(routes = ROUTES, options = {}) {
  const results = [];
  for (const route of routes) results.push(await checkRoute(route, options));
  return { ok: results.every((result) => result.ok), results };
}

export function renderReport({ edge, liveness }, checkedAt = new Date().toISOString()) {
  const ok = edge.ok && (!liveness || liveness.ok);
  const lines = [
    '## Production edge health',
    '',
    `- Checked at: ${checkedAt}`,
    `- Overall: ${ok ? 'PASS' : 'FAIL'}`,
    '',
    '| Route | Status | Cache-Control | Elapsed | Result |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const result of edge.results) {
    lines.push(`| ${result.name} | ${result.status} | ${result.cacheControl || '-'} | ${result.elapsedMs} ms | ${result.ok ? 'PASS' : `FAIL — ${result.reason}`} |`);
  }
  if (liveness) {
    lines.push('', '### Monitor liveness', '');
    for (const result of liveness.results) {
      lines.push(`- ${result.file}: ${result.ok ? 'PASS' : `FAIL — ${result.reason}`}`);
    }
  }
  return lines.join('\n');
}

export function failingMarker({ edge, liveness }) {
  const names = edge.results.filter((result) => !result.ok).map((result) => result.name);
  const jobs = (liveness?.results || []).filter((result) => !result.ok).map((result) => result.file);
  return `<!-- production-edge-health:failing=${[...names, ...jobs].sort().join(',')} -->`;
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
      'User-Agent': 'lgfc-production-edge-health',
    },
  };
}

async function main() {
  const edge = await runEdgeChecks();
  const context = githubContext();
  const liveness = context ? await runCheck(LIVENESS_JOBS, context) : null;
  const report = renderReport({ edge, liveness });
  const ok = edge.ok && (!liveness || liveness.ok);
  console.log(report);
  appendOpsStepSummary(report);
  if (!process.argv.includes('--escalate')) return ok ? 0 : 1;
  if (!context) throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required to escalate.');
  if (!ok) {
    await escalateOpsRuntimeFailure({
      workflowName: 'OPS — Production Edge Health',
      title: ESCALATION_TITLE,
      runUrl: process.env.OPS_ESCALATION_RUN_URL || '',
      details: `${failingMarker({ edge, liveness })}\n${report}`,
      nextSteps: [
        'Open the linked run and read the failing route or the monitor-liveness row.',
        'A missing or long-lived cache-control header is a stale-content risk. A slow route is a baseline miss.',
        'A stale ops-scheduled-job-health.yml row means the monitor of monitors has stopped. Read its latest runs.',
        'Record the cause here, then close this Issue. This check does not close it.',
      ],
      labels: ['ops-runtime-failure', 'team:operations'],
    });
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
