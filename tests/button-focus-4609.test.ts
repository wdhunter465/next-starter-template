import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globals = readFileSync('src/app/globals.css', 'utf8');
const join = readFileSync('src/components/JoinCTA.tsx', 'utf8');
const matchup = readFileSync('src/components/WeeklyMatchup.tsx', 'utf8');

describe('button, link and form styles (#4609)', () => {
  it('does not force Join and Login to plain white text', () => {
    expect(globals).not.toContain('.joinBanner .joinBanner .join-banner__btn');
    expect(globals).toContain('.joinBanner a:not(.join-banner__btn)');
    expect(join).toContain('join-banner__btn join-banner__btn--primary');
    expect(join).toContain('join-banner__btn join-banner__btn--secondary');
    expect(globals).toContain('.joinBanner .join-banner__btn--primary');
    expect(globals).toMatch(/\.join-banner__btn--primary[\s\S]*color:\s*var\(--lgfc-blue/);
  });

  it('gives Vote the shared primary button instead of a native grey button', () => {
    expect(matchup).not.toMatch(/className="btn"/);
    expect(matchup).toContain('className="btn primary"');
    expect(globals).toContain('.btn.primary');
    expect(globals).toMatch(/\.btn\.primary\s*\{[^}]*background:\s*var\(--lgfc-blue/);
  });

  it('draws a keyboard focus ring on links, buttons and form controls', () => {
    expect(globals).toContain('a:focus-visible');
    expect(globals).toContain('button:focus-visible');
    expect(globals).toContain('input:focus-visible');
    expect(globals).toContain('select:focus-visible');
    expect(globals).toContain('textarea:focus-visible');
    expect(globals).toContain('outline: 3px solid var(--lgfc-blue, #0033cc)');
    expect(globals).toContain('.joinBanner :focus-visible');
  });
});
