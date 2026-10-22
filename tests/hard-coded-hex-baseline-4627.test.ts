import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectHardCodedHexLiterals } from '../scripts/ci/hard-coded-hex-literals.mjs';

// #4627. docs/reference/design/color-standard.md allows a hex only as the
// fallback inside var(--token, #hex). Every other literal under src/, outside
// the token files, is listed here. The list may only shrink: a new literal
// fails, and removing one requires deleting its line from the baseline.

const baselinePath = resolve(process.cwd(), 'tests/fixtures/hard-coded-hex-baseline-4627.txt');

describe('hard-coded hex baseline (#4627)', () => {
  it('matches the baseline and does not grow', () => {
    const current = collectHardCodedHexLiterals();
    const baseline = readFileSync(baselinePath, 'utf8').trim().split('\n').filter(Boolean);
    const baselineSet = new Set(baseline);
    const currentSet = new Set(current);
    const added = current.filter((line) => !baselineSet.has(line));
    const stale = baseline.filter((line) => !currentSet.has(line));
    expect(added, 'new hard-coded hex outside the token files').toEqual([]);
    expect(stale, 'baseline still lists a literal that was removed; shrink the baseline').toEqual([]);
  });
});
