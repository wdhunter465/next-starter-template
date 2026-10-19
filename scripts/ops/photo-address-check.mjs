#!/usr/bin/env node
// Photo address check (#4683, monitoring gap 3). Samples the photo addresses the live public
// pages and APIs serve (the public photo list and the current Weekly Matchup) and confirms each
// one returns an image from Backblaze. A 404, an XML error body, a non-image or a timeout is a
// failure. Public URLs only; no credentials, no database access, no member data, no writes.

import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary, escalateOpsRuntimeFailure } from '../ci/ops_runtime_escalation.mjs';
import { checkPhotoAddress, listPublicPhotos } from './b2-d1-relationship-check.mjs';

export const ESCALATION_TITLE = 'OPS — Photo address check — failure detected';
export const DEFAULT_BASE = 'https://www.lougehrigfanclub.com';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listMatchupPhotos(base, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const response = await fetchImpl(`${base}/api/matchup/current`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`matchup returned ${response.status}`);
  const body = await response.json();
  return (Array.isArray(body?.items) ? body.items : []).filter((item) => item?.url);
}

// Addresses come from the live public list and the current matchup, each address once.
export async function collectAddresses(base, options = {}) {
  const addresses = new Map();
  const listErrors = [];
  const sources = [
    ['photos', () => listPublicPhotos(base, options)],
    ['matchup', () => listMatchupPhotos(base, options)],
  ];
  for (const [source, load] of sources) {
    try {
      for (const item of await load()) {
        if (item?.url && !addresses.has(item.url)) addresses.set(item.url, { source, id: item.id ?? null, url: item.url });
      }
    } catch (error) {
      listErrors.push({ source, reason: error?.name === 'TimeoutError' ? 'timeout' : String(error?.message || error) });
    }
  }
  return { addresses: [...addresses.values()], listErrors };
}

// One address is a failure only if it fails on every attempt.
export async function checkAddress(address, { attempts = 2, retryDelayMs = 5_000, ...options } = {}) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await checkPhotoAddress({ id: address.id, url: address.url }, options);
    if (result.ok) break;
    if (attempt < attempts) await sleep(retryDelayMs);
  }
  return { ...address, ok: result.ok, status: result.status, reason: result.reason };
}

export async function runAddressCheck(base = DEFAULT_BASE, options = {}) {
  const { addresses, listErrors } = await collectAddresses(base, options);
  const results = [];
  for (const address of addresses) results.push(await checkAddress(address, options));
  const failed = results.filter((result) => !result.ok);
  return { base, total: results.length, ok: failed.length === 0 && listErrors.length === 0, failed, listErrors };
}

export function renderReport(report, checkedAt = new Date().toISOString()) {
  const lines = [
    '## Photo address check',
    '',
    `- Checked at: ${checkedAt}`,
    `- Base: ${report.base}`,
    `- Addresses sampled: ${report.total}`,
    `- Failed: ${report.failed.length}`,
    `- Overall: ${report.ok ? 'PASS' : 'FAIL'}`,
  ];
  for (const error of report.listErrors) lines.push(`- Could not list ${error.source}: ${error.reason}`);
  if (report.failed.length) {
    lines.push('', '| Source | Id | Address | Result |', '| --- | --- | --- | --- |');
    for (const item of report.failed) {
      lines.push(`| ${item.source} | ${item.id ?? ''} | ${item.url} | ${item.reason}${item.status ? ` (HTTP ${item.status})` : ''} |`);
    }
  }
  return lines.join('\n');
}

// Stable marker so the same failing set is reported once, not on every run.
export function failingMarker(report) {
  const names = [
    ...report.failed.map((item) => `${item.source}:${item.id ?? item.url}`),
    ...report.listErrors.map((error) => `list:${error.source}`),
  ].sort();
  return `<!-- photo-address-check:failing=${names.join(',')} -->`;
}

async function findOpenEscalation() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) return null;
  const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'lgfc-photo-address-check' },
  });
  if (!response.ok) throw new Error(`list issues failed: ${response.status}`);
  return (await response.json()).find((issue) => issue.title === ESCALATION_TITLE && !issue.pull_request) || null;
}

export async function main(argv = process.argv.slice(2)) {
  const baseIndex = argv.indexOf('--base');
  const base = (baseIndex >= 0 ? argv[baseIndex + 1] : DEFAULT_BASE).replace(/\/$/, '');
  const report = await runAddressCheck(base);
  const text = renderReport(report);
  console.log(text);
  appendOpsStepSummary(text);
  if (report.ok) return 0;
  if (!argv.includes('--escalate')) return 1;

  const marker = failingMarker(report);
  const open = await findOpenEscalation();
  if (open?.body?.includes(marker)) {
    console.log(`Same failing addresses already reported on #${open.number}; not re-posting.`);
    return 1;
  }
  const outcome = await escalateOpsRuntimeFailure({
    workflowName: 'OPS — Photo address check',
    title: ESCALATION_TITLE,
    runUrl: process.env.OPS_ESCALATION_RUN_URL || '',
    details: `${marker}\n${text}`,
    nextSteps: [
      'Open each failing address. A 404 with an XML body means the Backblaze object is missing or its bucket path changed.',
      'Compare the address with the photo row the site lists, then restore the object or correct the row under a source Issue.',
      'Record the cause and recovery evidence here, then close this Issue.',
    ],
    labels: ['ops-runtime-failure', 'team:operations'],
  });
  console.log(JSON.stringify(outcome));
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
