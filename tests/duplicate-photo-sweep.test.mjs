import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureHashes, findNearDuplicates, ISSUE_TITLE, originalKey, runSweep } from '../scripts/ops/duplicate-photo-sweep.mjs';

const HASH_855 = '0000000000000000';
const HASH_857 = '000000000000007f';

describe('published photo near-duplicate sweep (#4707)', () => {
  it('reports photos 855 and 857 as a pair at distance 7', () => {
    const pairs = findNearDuplicates([
      { id: 855, url: 'https://cdn.example/photos/855.jpg', filename: '855.jpg', size: 4000, hash: HASH_855 },
      { id: 857, url: 'https://cdn.example/photos/857.jpg', filename: '857.jpg', size: 4100, hash: HASH_857 },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].distance).toBe(7);
    expect(pairs[0].left.id).toBe(855);
    expect(pairs[0].right.id).toBe(857);
    expect(pairs[0].largerId).toBe(857);
  });

  it('compares a photo that has no stored hash', async () => {
    const calls = [];
    const ready = await ensureHashes(
      [
        { id: 1, url: 'https://cdn.example/a.jpg', bytes: new Uint8Array([1, 2, 3]) },
        { id: 2, url: 'https://cdn.example/b.jpg', hash: HASH_857, size: 10 },
      ],
      async (bytes) => {
        calls.push(bytes.length);
        return HASH_855;
      },
    );
    expect(calls).toEqual([3]);
    expect(findNearDuplicates(ready)).toHaveLength(1);
  });

  it('does not report renditions of one original as duplicates', () => {
    const medium = 'https://cdn.example/renditions/501/medium.jpg';
    const thumbnail = 'https://cdn.example/renditions/501/thumbnail.jpg';
    expect(originalKey(medium)).toBe(originalKey(thumbnail));
    const pairs = findNearDuplicates([
      { id: 11, url: medium, size: 8000, hash: HASH_855 },
      { id: 12, url: thumbnail, size: 900, hash: HASH_855 },
      { id: 13, url: 'https://cdn.example/renditions/900/original.jpg', size: 100, hash: 'ffffffffffffffff' },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('opens one Operations Issue for a new pair and stays quiet for a reviewed pair', async () => {
    const opened = [];
    const photos = [
      { id: 855, url: 'https://cdn.example/855.jpg', filename: '855.jpg', size: 4000, hash: HASH_855 },
      { id: 857, url: 'https://cdn.example/857.jpg', filename: '857.jpg', size: 4100, hash: HASH_857 },
    ];
    const created = await runSweep(photos, { openIssue: async (issue) => { opened.push(issue); return { opened: true, number: 1 }; } });
    expect(created.pairs).toHaveLength(1);
    expect(opened).toHaveLength(1);
    expect(opened[0].title).toBe(ISSUE_TITLE);

    const reviewed = await runSweep(photos, {
      allowlist: { pairs: [{ ids: [855, 857] }] },
      openIssue: async () => { throw new Error('reviewed pair must not open an issue'); },
    });
    expect(reviewed.pairs).toHaveLength(0);
    expect(reviewed.outcome).toBeNull();
  });

  it('has no Production write path', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/ops/duplicate-photo-sweep.mjs'), 'utf8');
    expect(source).not.toMatch(/wrangler|DB\.prepare|PUT |DELETE /);
  });
});
