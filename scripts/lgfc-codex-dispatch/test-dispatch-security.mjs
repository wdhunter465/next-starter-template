#!/usr/bin/env node
/**
 * Security-negative and positive unit tests for LGFC Codex dispatch (#4052).
 * Does not invoke the live Codex agent.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDispatchArgv, buildIdentifiersOnlyPrompt } from './lib/argv.mjs';
import { acquireDispatchLock } from './lib/preflight.mjs';
import { shouldDeliverCodexWake } from './lib/wake-ingress.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const dispatchBin = path.join(here, 'dispatch.mjs');

function baseArgs(extra = []) {
  return [
    '--repo',
    'wdhunter465/next-starter-template',
    '--issue',
    '4052',
    '--event',
    'workflow_dispatch',
    '--delivery-id',
    'wake-1-4052',
    '--run-id',
    '1',
    ...extra
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
  assert.equal(parsed.values.issueNumber, 4052);
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
    '1'
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
    '1'
  ]);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, 'invalid_issue');
});

test('rejects untrusted event names including pull_request', () => {
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
    '1'
  ]);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, 'invalid_event');
});

test('prompt contains identifiers only and no body markers', () => {
  const prompt = buildIdentifiersOnlyPrompt({
    repo: 'wdhunter465/next-starter-template',
    issueNumber: 4052,
    event: 'workflow_dispatch',
    deliveryId: 'wake-9-4052',
    runId: '9'
  });
  assert.match(prompt, /Source Issue: #4052/);
  assert.match(prompt, /wake signal only/i);
  assert.doesNotMatch(prompt, /Issue body/);
  assert.doesNotMatch(prompt, /Recent Issue comments/);
  assert.doesNotMatch(prompt, /dangerously-bypass/);
});

test('exclusive lock rejects second acquisition', () => {
  const lockPath = path.join(os.tmpdir(), `lgfc-codex-dispatch-test-${process.pid}.lock`);
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

test('label wake requires agent:codex and handoff:ready', () => {
  const miss = shouldDeliverCodexWake({
    repository: 'wdhunter465/next-starter-template',
    eventName: 'issues',
    action: 'labeled',
    labelName: 'agent:codex',
    issueLabels: ['agent:codex']
  });
  assert.equal(miss.deliver, false);
  const ok = shouldDeliverCodexWake({
    repository: 'wdhunter465/next-starter-template',
    eventName: 'issues',
    action: 'labeled',
    labelName: 'handoff:ready',
    issueLabels: ['agent:codex', 'handoff:ready']
  });
  assert.equal(ok.deliver, true);
});

test('cursor-routed issues do not wake Codex', () => {
  const decision = shouldDeliverCodexWake({
    repository: 'wdhunter465/next-starter-template',
    eventName: 'issues',
    action: 'labeled',
    labelName: 'handoff:ready',
    issueLabels: ['agent:cursor', 'handoff:ready']
  });
  assert.equal(decision.deliver, false);
});

test('untrusted repository fails closed', () => {
  const decision = shouldDeliverCodexWake({
    repository: 'evil/repo',
    eventName: 'issues',
    action: 'labeled',
    labelName: 'agent:codex',
    issueLabels: ['agent:codex', 'handoff:ready']
  });
  assert.equal(decision.deliver, false);
  assert.equal(decision.reason, 'untrusted_repository');
});

test('pull_request events are unrelated traffic', () => {
  const decision = shouldDeliverCodexWake({
    repository: 'wdhunter465/next-starter-template',
    eventName: 'pull_request',
    action: 'opened',
    issueLabels: ['agent:codex', 'handoff:ready']
  });
  assert.equal(decision.deliver, false);
  assert.equal(decision.reason, 'unrelated_github_traffic');
});

test('dispatch.mjs --dry-run succeeds on clean workspace', () => {
  const result = spawnSync(
    process.execPath,
    [dispatchBin, ...baseArgs(['--dry-run', '--workspace', repoRoot])],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        LGFC_CODEX_DISPATCH_LOCK: path.join(os.tmpdir(), `lgfc-codex-dry-${process.pid}.lock`),
        LGFC_CODEX_DISPATCH_ALLOW_DIRTY: '1'
      }
    }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /dry_run_ok/);
});

test('workflow YAML must not use pull_request or workflow_run triggers', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-codex-dispatch.yml'),
    'utf8'
  );
  const onBlock = wf.match(/^on:\n([\s\S]*?)\n\npermissions:/m)?.[1] || '';
  assert.doesNotMatch(onBlock, /^\s*pull_request(_target)?\s*:/m);
  assert.doesNotMatch(onBlock, /^\s*workflow_run\s*:/m);
  assert.match(wf, /runs-on:\s*\[self-hosted,\s*linux,\s*x64,\s*lgfc-codex\]/);
  assert.match(onBlock, /workflow_dispatch:/);
  assert.doesNotMatch(wf, /dangerously-bypass/);
});

test('health workflow must run on GitHub-hosted ubuntu-latest', () => {
  const wf = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/lgfc-codex-runner-health.yml'),
    'utf8'
  );
  assert.match(wf, /runs-on:\s*ubuntu-latest/);
  assert.doesNotMatch(wf, /runs-on:\s*\[self-hosted/);
});

if (!process.exitCode) {
  console.log('All lgfc-codex-dispatch security tests passed.');
}
