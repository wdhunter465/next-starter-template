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
import { acquireDispatchLock } from './lib/preflight.mjs';

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
});

test('health workflow must run on GitHub-hosted ubuntu-latest', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-cursor-runner-health.yml'),
    'utf8',
  );
  assert.match(wf, /runs-on:\s*ubuntu-latest/);
  assert.doesNotMatch(wf, /runs-on:\s*\[self-hosted/);
});

if (!process.exitCode) {
  console.log('All lgfc-cursor-dispatch security tests passed.');
}
