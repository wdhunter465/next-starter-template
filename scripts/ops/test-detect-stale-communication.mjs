#!/usr/bin/env node
/**
 * Offline harness for scripts/ops/detect-stale-communication.mjs (#3188).
 * Invokes --mode=self-test only. Never calls GitHub.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'detect-stale-communication.mjs');

const result = spawnSync(process.execPath, [script, '--mode=self-test'], {
  encoding: 'utf8',
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exitCode = result.status === 0 ? 0 : 1;
if (result.status !== 0) {
  console.error('test-detect-stale-communication FAILED');
}
