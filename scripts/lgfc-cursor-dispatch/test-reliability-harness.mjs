#!/usr/bin/env node
/**
 * Phase 3 local reliability harness for LGFC Cursor dispatch (#3212).
 * Does not require GitHub Actions actor privileges.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const dispatchBin = path.join(here, 'dispatch.mjs');

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function runDispatch(extraArgs = [], env = {}) {
  const lock = path.join(os.tmpdir(), `lgfc-phase3-${process.pid}-${Math.random().toString(16).slice(2)}.lock`);
  return spawnSync(
    process.execPath,
    [
      dispatchBin,
      '--repo',
      'wdhunter465/next-starter-template',
      '--issue',
      '3212',
      '--event',
      'workflow_dispatch',
      '--delivery-id',
      `wake-phase3-${Date.now()}`,
      '--run-id',
      String(Date.now()),
      '--workspace',
      repoRoot,
      ...extraArgs,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        LGFC_CURSOR_DISPATCH_LOCK: lock,
        LGFC_CURSOR_DISPATCH_ALLOW_DIRTY: '1',
        ...env,
      },
    },
  );
}

// 1) Repeated dry-run dispatch
{
  let ok = true;
  let detail = '';
  for (let i = 0; i < 5; i += 1) {
    const r = runDispatch(['--dry-run']);
    if (r.status !== 0 || !/dry_run_ok/.test(r.stdout || '')) {
      ok = false;
      detail = `iteration ${i + 1} status=${r.status}`;
      break;
    }
  }
  record('repeated_dry_run_dispatch_x5', ok, detail || '5 consecutive dry-runs');
}

// 2) Duplicate / concurrent serialization via lock
{
  const sharedLock = path.join(os.tmpdir(), `lgfc-phase3-shared-${process.pid}.lock`);
  fs.rmSync(sharedLock, { force: true });
  const first = spawnSync(
    process.execPath,
    [
      dispatchBin,
      '--repo',
      'wdhunter465/next-starter-template',
      '--issue',
      '3212',
      '--event',
      'workflow_dispatch',
      '--delivery-id',
      'wake-lock-1',
      '--run-id',
      '1',
      '--dry-run',
      '--workspace',
      repoRoot,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        LGFC_CURSOR_DISPATCH_LOCK: sharedLock,
        LGFC_CURSOR_DISPATCH_ALLOW_DIRTY: '1',
      },
    },
  );
  // Hold lock manually to simulate in-flight dispatch
  fs.writeFileSync(sharedLock, JSON.stringify({ pid: process.pid, held: true }));
  const second = spawnSync(
    process.execPath,
    [
      dispatchBin,
      '--repo',
      'wdhunter465/next-starter-template',
      '--issue',
      '3212',
      '--event',
      'workflow_dispatch',
      '--delivery-id',
      'wake-lock-2',
      '--run-id',
      '2',
      '--dry-run',
      '--workspace',
      repoRoot,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        LGFC_CURSOR_DISPATCH_LOCK: sharedLock,
        LGFC_CURSOR_DISPATCH_ALLOW_DIRTY: '1',
      },
    },
  );
  fs.rmSync(sharedLock, { force: true });
  const ok = first.status === 0 && second.status === 4 && /dispatch_lock_held/.test(second.stderr || second.stdout || '');
  record('duplicate_dispatch_serialized_by_lock', ok, `first=${first.status} second=${second.status}`);
}

// 3) Failure signaling — invalid argv
{
  const r = spawnSync(
    process.execPath,
    [dispatchBin, '--repo', 'evil/repo', '--issue', '1', '--event', 'workflow_dispatch', '--delivery-id', 'x', '--run-id', '1'],
    { encoding: 'utf8' },
  );
  record('failure_signal_invalid_repo', r.status === 2, `status=${r.status}`);
}

// 4) Failure signaling — pull_request event rejected
{
  const r = spawnSync(
    process.execPath,
    [
      dispatchBin,
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
    ],
    { encoding: 'utf8' },
  );
  record('failure_signal_untrusted_event', r.status === 2, `status=${r.status}`);
}

// 5) Existing security suite still green
{
  const r = spawnSync(process.execPath, [path.join(here, 'test-dispatch-security.mjs')], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  record('security_unit_suite', r.status === 0, `status=${r.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  JSON.stringify(
    {
      suite: 'lgfc-cursor-dispatch-phase3-local',
      passed: results.filter((r) => r.ok).length,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);
process.exitCode = failed.length ? 1 : 0;
