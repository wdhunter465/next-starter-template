#!/usr/bin/env node
/**
 * Offline harness for scripts/ops/lgfc-ci-storm-issue-triage.mjs (#2095).
 * Invokes --mode=self-test only. Never closes issues.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'lgfc-ci-storm-issue-triage.mjs');

const result = spawnSync(process.execPath, [script, '--mode=self-test'], {
  encoding: 'utf8',
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exitCode = result.status === 0 ? 0 : 1;
if (result.status !== 0) {
  console.error('test-lgfc-ci-storm-issue-triage FAILED');
}
