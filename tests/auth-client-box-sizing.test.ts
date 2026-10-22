import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #4759: full-width form controls with padding must size by border-box, or they overflow a phone
// screen (the Join page was 4px wider than 390px). The qualification spec for #4467 re-checks
// the rendered page on Production.
const source = readFileSync('src/app/auth/AuthClient.tsx', 'utf8');

describe('AuthClient full-width controls (#4759)', () => {
  it('sets border-box on every full-width style that has padding', () => {
    const styles = source.match(/style=\{\{[^}]*width: '100%'[^}]*\}\}/g) ?? [];
    expect(styles.length).toBeGreaterThanOrEqual(6);
    const missing = styles.filter((style) => /padding/.test(style) && !/boxSizing: 'border-box'/.test(style));
    expect(missing).toEqual([]);
  });
});
