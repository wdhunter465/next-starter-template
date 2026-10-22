import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('brand colour tokens (#4608, D-001 to D-081)', () => {
  it('defines the LGFC blue once, as #0033cc, in globals.css', () => {
    const globals = read('src/app/globals.css');
    expect(globals).toMatch(/--lgfc-blue:\s*#0033cc/i);
    expect(globals).toMatch(/--lgfc-blue-hover:\s*#0028a3/i);
  });

  it('variables.css does not redefine --lgfc-blue (it loads after globals.css and would win)', () => {
    const vars = read('src/styles/variables.css');
    expect(vars).not.toMatch(/--lgfc-blue\s*:/);
  });

  it('page background comes from the page token, not a second off-white', () => {
    const vars = read('src/styles/variables.css');
    expect(vars).toMatch(/html,body\{background:var\(--lgfc-bg-page/);
  });

  it('no stray blues: navy #002868 and #1e3a8a are gone from source', () => {
    for (const p of [
      'src/styles/variables.css',
      'src/app/fanclub/photo/page.tsx',
      'src/app/fanclub/memorabilia/page.module.css',
    ]) {
      const text = read(p);
      expect(text, p).not.toMatch(/#002868/i);
      expect(text, p).not.toMatch(/#1e3a8a/i);
    }
  });

  it('hard-coded #0033cc only appears as a var() fallback', () => {
    for (const p of [
      'src/components/AnalyticsConsent.tsx',
      'src/components/home/CampaignSpotlightCard.module.css',
      'src/app/admin/fundraiser-preview/page.tsx',
    ]) {
      const text = read(p);
      const bare = text.split('\n').filter((l) => /#0033cc/i.test(l) && !/var\(--lgfc-blue,\s*#0033cc\)/i.test(l));
      expect(bare, p).toEqual([]);
    }
  });
});
