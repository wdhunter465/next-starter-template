#!/usr/bin/env node
/**
 * Test entry for `tests/` layout required by #4052.
 * Delegates to the security-negative harness next to the wrapper.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.resolve(here, '../scripts/lgfc-codex-dispatch/test-dispatch-security.mjs');
const result = spawnSync(process.execPath, [harness], { stdio: 'inherit' });
process.exit(result.status === 0 ? 0 : 1);
