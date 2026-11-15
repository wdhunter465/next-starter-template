import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('radius scale (#4420, D-027 and D-016; style guide 18 / 14 / 12)', () => {
  const globals = read('src/app/globals.css');

  it('defines the scale once: 12px small, 14px standard, 18px large', () => {
    expect(globals).toMatch(/--lgfc-radius-md:\s*12px/);
    expect(globals).toMatch(/--lgfc-radius-lg:\s*14px/);
    expect(globals).toMatch(/--lgfc-radius-xl:\s*18px/);
  });

  it('the Join banner radius comes from a token in its last rule (#4610 chose the 14px standard-card token)', () => {
    const rules = [...globals.matchAll(/\.joinBanner\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const withRadius = rules.filter((r) => /border-radius/.test(r));
    expect(withRadius.length).toBeGreaterThan(0);
    expect(withRadius[withRadius.length - 1]).toMatch(/border-radius:\s*var\(--lgfc-radius-lg\)/);
  });

  it('small controls (menu buttons, FAQ inputs and buttons, header buttons) use the 12px token, not 10px', () => {
    for (const p of [
      'src/app/globals.css',
      'src/components/Header.module.css',
      'src/components/FanClubHeader.module.css',
      'src/components/HamburgerMenu.module.css',
    ]) {
      expect(read(p), p).not.toMatch(/border-radius:\s*10px/);
    }
  });
});
