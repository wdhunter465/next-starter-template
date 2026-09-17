import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.resolve(here, '../scripts/lgfc-codex-dispatch/test-dispatch-security.mjs');

describe('lgfc-codex-dispatch (#4052)', () => {
  it('passes the security-negative harness without exiting the Vitest worker', () => {
    const result = spawnSync(process.execPath, [harness], { encoding: 'utf8' });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('All lgfc-codex-dispatch security tests passed.');
  });
});
