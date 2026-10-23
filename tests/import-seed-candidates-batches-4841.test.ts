import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function dryRun(extraArgs: string[]): string {
  return execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/content-pipeline/import-seed-candidates.mjs',
      '--file',
      'data/research/lou-gehrig-content-candidates.json',
      '--dry-run',
      ...extraArgs,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
}

describe('import-seed-candidates batching (#4841)', () => {
  it('splits the registry into batches of the requested size', () => {
    const output = dryRun(['--batch-size', '5']);
    expect(output).toMatch(/in 6 batch\(es\) of up to 5 candidate\(s\)/);
  });

  it('defaults to one candidate per batch', () => {
    const output = dryRun([]);
    expect(output).toMatch(/in 30 batch\(es\) of up to 1 candidate\(s\)/);
  });
});
