#!/usr/bin/env node
/**
 * Security-negative and positive unit tests for LGFC Cursor dispatch Phase 2.
 * Does not invoke the live Cursor agent.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDispatchArgv, buildIdentifiersOnlyPrompt } from './lib/argv.mjs';
import { acquireDispatchLock, probeCursorCliAuth, postCliAuthRequiredComment } from './lib/preflight.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const dispatchBin = path.join(here, 'dispatch.mjs');

function baseArgs(extra = []) {
  return [
    '--repo',
    'wdhunter465/next-starter-template',
    '--issue',
    '3212',
    '--event',
    'workflow_dispatch',
    '--delivery-id',
    'wake-1-3212',
    '--run-id',
    '1',
    ...extra,
  ];
}

function assertTrustedDispatchActor(wf) {
  assert.match(wf, /github\.actor\s*==\s*['"]wdhunter465['"]/);
  assert.doesNotMatch(wf, /github\.actor\s*==\s*['"]wdhunter645['"]/);
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test('accepts valid identifiers-only argv', () => {
  const parsed = parseDispatchArgv(baseArgs());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.values.issueNumber, 3212);
});

test('rejects unexpected repository slug', () => {
  const parsed = parseDispatchArgv([
    '--repo',
    'wdhunter645/next-starter-template',
    '--issue',
    '1',
    '--event',
    'workflow_dispatch',
    '--delivery-id',
    'wake-1-1',
    '--run-id',
    '1',
  ]);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unexpected_repo/);
});

test('rejects unknown flags (comment-injection style)', () => {
  const parsed = parseDispatchArgv(baseArgs(['--prompt', 'rm -rf /']));
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unknown_flag/);
});

test('rejects non-integer issue numbers', () => {
  const parsed = parseDispatchArgv([
    '--repo',
    'wdhunter465/next-starter-template',
    '--issue',
    '12;curl evil',
    '--event',
    'workflow_dispatch',
    '--delivery-id',
    'wake-1-1',
    '--run-id',
    '1',
  ]);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, 'invalid_issue');
});

test('rejects untrusted event names', () => {
  const parsed = parseDispatchArgv([
    '--repo',
    'wdhunter465/next-starter-template',
    '--issue',
    '1',
    '--event',
    'pull_request',
    '--delivery-id',
    'wake-1-1',
    '--run-id',
    '1',
  ]);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, 'invalid_event');
});

test('prompt contains identifiers only and no body markers', () => {
  const prompt = buildIdentifiersOnlyPrompt({
    repo: 'wdhunter465/next-starter-template',
    issueNumber: 3212,
    event: 'workflow_dispatch',
    deliveryId: 'wake-9-3212',
    runId: '9',
  });
  assert.match(prompt, /Source Issue: #3212/);
  assert.match(prompt, /wake signal only/i);
  assert.doesNotMatch(prompt, /Issue body/);
  assert.doesNotMatch(prompt, /Recent Issue comments/);
});

test('exclusive lock rejects second acquisition', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-cursor-dispatch-test-${process.pid}.lock`);
  try {
    fs.rmSync(lockPath, { force: true });
    const first = acquireDispatchLock(lockPath);
    assert.equal(first.ok, true);
    const second = acquireDispatchLock(lockPath);
    assert.equal(second.ok, false);
    assert.equal(second.error, 'dispatch_lock_held');
    first.release();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
});

test('lock held by a live process is never reclaimed regardless of age override', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-cursor-dispatch-live-${process.pid}.lock`);
  fs.rmSync(lockPath, { force: true });
  const first = acquireDispatchLock(lockPath);
  assert.equal(first.ok, true);
  try {
    // Even an aggressively small staleness ceiling must not steal a lock
    // whose recorded pid is confirmed alive.
    const second = acquireDispatchLock(lockPath, { staleAfterMs: 1 });
    assert.equal(second.ok, false);
    assert.equal(second.error, 'dispatch_lock_held');
  } finally {
    first.release();
    fs.rmSync(lockPath, { force: true });
  }
});

test('stale lock left by a dead process is reclaimed automatically', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-cursor-dispatch-dead-${process.pid}.lock`);
  fs.rmSync(lockPath, { force: true });
  // A short-lived child that has already exited by the time spawnSync
  // returns -- its pid is guaranteed dead, deterministically, no timing games.
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }, null, 2) + '\n',
  );
  try {
    const result = acquireDispatchLock(lockPath);
    assert.equal(result.ok, true);
    assert.equal(result.reclaimedStaleLock, true);
    result.release();
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
});

test('corrupt lock with no readable pid falls back to age-based staleness', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-cursor-dispatch-corrupt-${process.pid}.lock`);
  fs.rmSync(lockPath, { force: true });
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, 'not json');
  // Backdate mtime explicitly rather than relying on real elapsed wall time,
  // which can be shorter than filesystem mtime resolution on some hosts.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(lockPath, oneHourAgo, oneHourAgo);

  try {
    // Recent-relative-to-ceiling corrupt lock, default (large) ceiling: still held.
    const stillHeld = acquireDispatchLock(lockPath);
    assert.equal(stillHeld.ok, false);
    assert.equal(stillHeld.error, 'dispatch_lock_held');

    // Same file, ceiling shorter than its (backdated) age: reclaimed.
    const reclaimed = acquireDispatchLock(lockPath, { staleAfterMs: 1000 });
    assert.equal(reclaimed.ok, true);
    assert.equal(reclaimed.reclaimedStaleLock, true);
    reclaimed.release();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
});

test('reclaim is serialized: an in-progress reclaim guard blocks a second reclaimer', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-cursor-dispatch-guarded-${process.pid}.lock`);
  const guardPath = `${lockPath}.reclaiming`;
  fs.rmSync(lockPath, { force: true });
  fs.rmSync(guardPath, { force: true });
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }, null, 2) + '\n',
  );
  // Simulate another process already mid-reclaim of this exact lock.
  fs.writeFileSync(guardPath, '');
  try {
    const result = acquireDispatchLock(lockPath);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'dispatch_lock_held');
    // Must not have deleted the stale lock out from under the process that
    // holds the reclaim guard -- that's the exact race Copilot flagged on
    // review-comment:4065910427 (a bare unlink-then-recreate lets a second
    // reclaimer delete the first reclaimer's freshly created live lock).
    assert.equal(fs.existsSync(lockPath), true);
  } finally {
    fs.rmSync(guardPath, { force: true });
    fs.rmSync(lockPath, { force: true });
  }
});

test('dispatch.mjs --dry-run succeeds on clean workspace', () => {
  const result = spawnSync(
    process.execPath,
    [dispatchBin, ...baseArgs(['--dry-run', '--workspace', repoRoot])],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        LGFC_CURSOR_DISPATCH_LOCK: path.join(os.tmpdir(), `lgfc-dry-${process.pid}.lock`),
        LGFC_CURSOR_DISPATCH_ALLOW_DIRTY: '1',
        LGFC_CURSOR_DISPATCH_SKIP_CLI_AUTH: '1',
        LGFC_CURSOR_DISPATCH_SKIP_ISSUE_COMMENT: '1',
      },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /dry_run_ok/);
});

test('workflow YAML must not use pull_request triggers', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-cursor-dispatch.yml'),
    'utf8',
  );
  // Inspect the `on:` trigger block only (comments may mention forbidden triggers).
  const onBlock = wf.match(/^on:\n([\s\S]*?)\n\npermissions:/m)?.[1] || '';
  assert.doesNotMatch(onBlock, /^\s*pull_request(_target)?\s*:/m);
  assert.match(wf, /runs-on:\s*\[self-hosted,\s*linux,\s*x64,\s*lgfc-cursor\]/);
  assert.match(onBlock, /workflow_dispatch:/);
  assertTrustedDispatchActor(wf);
});

test('health workflow must run on GitHub-hosted ubuntu-latest', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-cursor-runner-health.yml'),
    'utf8',
  );
  assert.match(wf, /runs-on:\s*ubuntu-latest/);
  assert.doesNotMatch(wf, /runs-on:\s*\[self-hosted/);
  assert.match(wf, /administration:\s*read/);
  assertTrustedDispatchActor(wf);
});

test('CLI auth probe fails closed on Authentication required', () => {
  const fakeSpawn = () => ({
    status: 1,
    stdout: '',
    stderr: "Error: Authentication required. Please run 'agent login' first.\n",
    error: null,
  });
  const result = probeCursorCliAuth({ kind: 'agent', bin: 'agent' }, { spawnSync: fakeSpawn });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'cli_auth_required');
});

test('CLI auth comment is skipped when explicitly disabled', () => {
  const prev = process.env.LGFC_CURSOR_DISPATCH_SKIP_ISSUE_COMMENT;
  process.env.LGFC_CURSOR_DISPATCH_SKIP_ISSUE_COMMENT = '1';
  try {
    const result = postCliAuthRequiredComment(4296, {
      spawnSync: () => {
        throw new Error('gh must not run when skip is set');
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  } finally {
    if (prev === undefined) delete process.env.LGFC_CURSOR_DISPATCH_SKIP_ISSUE_COMMENT;
    else process.env.LGFC_CURSOR_DISPATCH_SKIP_ISSUE_COMMENT = prev;
  }
});

test('dispatch workflow may write Issue comments after CLI auth preflight', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-cursor-dispatch.yml'),
    'utf8',
  );
  assert.match(wf, /issues:\s*write/);
});

if (!process.exitCode) {
  console.log('All lgfc-cursor-dispatch security tests passed.');
}
