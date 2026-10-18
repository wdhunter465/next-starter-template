import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('reduced motion (#4624, catalog row 63)', () => {
  const globals = read('src/app/globals.css');
  const block = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));

  it('globals.css stops animations, transitions and CSS smooth scroll under reduced motion', () => {
    expect(globals).toContain('@media (prefers-reduced-motion: reduce)');
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });

  it('no stylesheet turns the global rule off for an animated element', () => {
    for (const file of walk(resolve(root, 'src')).filter((f) => f.endsWith('.css'))) {
      const css = readFileSync(file, 'utf8');
      if (!/@keyframes|animation\s*:|transition\s*:/.test(css)) continue;
      expect(css, file).not.toMatch(/prefers-reduced-motion:\s*no-preference/);
    }
  });

  it('script smooth scrolling goes through motionSafeScrollBehavior', () => {
    const offenders = walk(resolve(root, 'src'))
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith('motionPreference.ts'))
      .filter((f) => /behavior:\s*['"]smooth['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('motionSafeScrollBehavior returns auto under reduced motion and smooth otherwise', async () => {
    const { motionSafeScrollBehavior } = await import('@/lib/motionPreference');
    const original = window.matchMedia;
    try {
      window.matchMedia = ((q: string) => ({ matches: true, media: q })) as unknown as typeof window.matchMedia;
      expect(motionSafeScrollBehavior()).toBe('auto');
      window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
      expect(motionSafeScrollBehavior()).toBe('smooth');
    } finally {
      window.matchMedia = original;
    }
  });
});
