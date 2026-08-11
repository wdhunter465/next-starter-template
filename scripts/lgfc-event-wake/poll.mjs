#!/usr/bin/env node
/**
 * LGFC non-AI event-wake poller (#3340).
 *
 * Idle loop uses only GitHub API/`gh` — no Cursor model inference.
 * On new actionable wake keys, invokes identifiers-only dispatch.mjs.
 *
 * Usage:
 *   node scripts/lgfc-event-wake/poll.mjs --once [--dry-run] [--status-only]
 *   node scripts/lgfc-event-wake/poll.mjs --interval-sec 60 [--dry-run]
 *
 * Environment:
 *   LGFC_EVENT_WAKE_REPO   default wdhunter465/next-starter-template
 *   LGFC_EVENT_WAKE_STATE_DIR  default ~/.lgfc-event-wake
 *   LGFC_EVENT_WAKE_WORKSPACE  optional workspace override for dispatch
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyIssue, wakeKey } from './lib/actionable.mjs';
import {
  alreadySeen,
  defaultStatePath,
  loadState,
  saveState,
} from './lib/watermark.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_REPO = 'wdhunter465/next-starter-template';

function log(level, message, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: 'lgfc-event-wake',
    message,
    ...extra,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function parseArgv(argv) {
  const values = {
    once: false,
    dryRun: false,
    statusOnly: false,
    intervalSec: 60,
    repo: process.env.LGFC_EVENT_WAKE_REPO || DEFAULT_REPO,
    workspace: process.env.LGFC_EVENT_WAKE_WORKSPACE || REPO_ROOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--once') {
      values.once = true;
      continue;
    }
    if (arg === '--dry-run') {
      values.dryRun = true;
      continue;
    }
    if (arg === '--status-only') {
      values.statusOnly = true;
      values.dryRun = true;
      continue;
    }
    if (arg === '--interval-sec') {
      const next = argv[++i];
      const n = Number(next);
      if (!Number.isFinite(n) || n < 5) {
        throw new Error(`invalid_interval:${next}`);
      }
      values.intervalSec = Math.floor(n);
      continue;
    }
    if (arg === '--repo') {
      values.repo = argv[++i];
      continue;
    }
    if (arg === '--workspace') {
      values.workspace = argv[++i];
      continue;
    }
    throw new Error(`unknown_arg:${arg}`);
  }
  return values;
}

function ghJson(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`gh_failed:${err || result.status}`);
  }
  return JSON.parse(result.stdout || '[]');
}

/**
 * Fetch candidate open issues via search (identifiers + labels only).
 * @param {string} repo
 */
export function fetchCandidateIssues(repo) {
  const q = `repo:${repo} is:issue is:open label:agent:cursor`;
  const labeled = ghJson([
    'api',
    `search/issues?q=${encodeURIComponent(q)}&per_page=50`,
    '--jq',
    '.items',
  ]);

  const opsQ = `repo:${repo} is:issue is:open label:ops:priority:1`;
  const ops = ghJson([
    'api',
    `search/issues?q=${encodeURIComponent(opsQ)}&per_page=20`,
    '--jq',
    '.items',
  ]);

  const byNumber = new Map();
  for (const issue of [...labeled, ...ops]) {
    if (issue?.number) byNumber.set(issue.number, issue);
  }
  return [...byNumber.values()];
}

function invokeDispatch({
  repo,
  issueNumber,
  reason,
  dryRun,
  workspace,
  deliveryId,
}) {
  const dispatchPath = path.join(
    REPO_ROOT,
    'scripts/lgfc-cursor-dispatch/dispatch.mjs',
  );
  const args = [
    dispatchPath,
    '--repo',
    repo,
    '--issue',
    String(issueNumber),
    '--event',
    'workflow_dispatch',
    '--delivery-id',
    deliveryId,
    '--run-id',
    `event-wake-${Date.now()}`,
    '--workspace',
    workspace,
  ];
  if (dryRun) args.push('--dry-run');

  log('info', 'invoke_dispatch', {
    issue: issueNumber,
    reason,
    dryRun,
    deliveryId,
  });

  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

/**
 * @param {ReturnType<typeof parseArgv>} options
 * @param {{ fetchIssues?: Function, invoke?: Function, statePath?: string }} [deps]
 */
export function pollOnce(options, deps = {}) {
  const started = Date.now();
  const statePath = deps.statePath || defaultStatePath();
  const state = loadState(statePath);
  const fetchIssues = deps.fetchIssues || fetchCandidateIssues;
  const invoke = deps.invoke || invokeDispatch;

  const issues = fetchIssues(options.repo);
  const wakes = [];

  for (const issue of issues) {
    const classified = classifyIssue(issue);
    if (!classified.actionable) continue;
    const key = wakeKey(issue, classified.reason);
    if (alreadySeen(state.seenWakeKeys, key)) continue;
    wakes.push({
      issueNumber: classified.issueNumber,
      reason: classified.reason,
      key,
      updatedAt: issue.updated_at || issue.updatedAt || null,
    });
  }

  const results = [];
  for (const wake of wakes) {
    const deliveryId = `ew-${wake.issueNumber}-${Buffer.from(wake.key)
      .toString('base64url')
      .slice(0, 24)}`;
    const ok = invoke({
      repo: options.repo,
      issueNumber: wake.issueNumber,
      reason: wake.reason,
      dryRun: options.dryRun || options.statusOnly,
      workspace: options.workspace,
      deliveryId,
    });
    results.push({ ...wake, ok });
    if (ok) state.seenWakeKeys.push(wake.key);
  }

  state.lastPollAt = new Date().toISOString();
  saveState(statePath, state);

  const elapsedMs = Date.now() - started;
  log('info', 'poll_complete', {
    candidates: issues.length,
    newWakes: wakes.length,
    invoked: results.filter((r) => r.ok).length,
    elapsedMs,
    dryRun: Boolean(options.dryRun || options.statusOnly),
  });

  return { wakes, results, elapsedMs, statePath };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgv(argv);
  log('info', 'poller_start', {
    once: options.once,
    intervalSec: options.intervalSec,
    dryRun: options.dryRun,
    statusOnly: options.statusOnly,
    repo: options.repo,
  });

  if (options.once) {
    pollOnce(options);
    return;
  }

  for (;;) {
    try {
      pollOnce(options);
    } catch (error) {
      log('error', 'poll_failed', { error: String(error?.message || error) });
    }
    await sleep(options.intervalSec * 1000);
  }
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((error) => {
    log('error', 'fatal', { error: String(error?.message || error) });
    process.exitCode = 1;
  });
}
