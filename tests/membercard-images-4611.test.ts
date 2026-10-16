import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The membership card section loads these two files by path. They returned 404 on
// Production (D-076, #4611) until they were added, so a missing or empty file fails here.

const root = process.cwd();
const section = readFileSync(resolve(root, 'src/components/fanclub/MembershipCardSection.tsx'), 'utf8');
const PNG_SIGNATURE = '89504e470d0a1a0a';

describe('membership card images (#4611, D-076)', () => {
  for (const name of ['membercard-front.png', 'membercard-back.png']) {
    it(`${name} is referenced by the card section and exists as a PNG`, () => {
      expect(section).toContain(`/${name}`);
      const file = resolve(root, 'public', name);
      expect(existsSync(file)).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
      expect(bytes.length).toBeGreaterThan(10_000);
    });
  }
});
