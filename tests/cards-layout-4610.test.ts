import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globals = readFileSync('src/app/globals.css', 'utf8');
const notFound = readFileSync('src/app/not-found.tsx', 'utf8');
const notFoundCss = readFileSync('src/app/not-found.module.css', 'utf8');

describe('cards, layout and spacing (#4610)', () => {
  it('defines the card, grid and link classes the home page already uses', () => {
    expect(globals).toMatch(/\.card\s*\{/);
    expect(globals).toMatch(/\.grid\s*\{/);
    expect(globals).toMatch(/\.link\s*\{/);
  });

  it('uses the 48/32/20 rhythm tokens for home section gaps', () => {
    expect(globals).toContain('--section-gap: var(--rhythm-lg)');
    expect(globals).toContain('--section-gap-moderate: var(--rhythm-md)');
    expect(globals).toContain('--section-gap-tight: var(--rhythm-sm)');
  });

  it('lets the radius token own the join banner', () => {
    const firstRule = globals.slice(globals.indexOf('/* Join banner */'), globals.indexOf('.joinBanner .join-banner__container'));
    expect(firstRule).not.toContain('border-radius: 20px');
    expect(globals).toContain('border-radius: var(--lgfc-radius-lg)');
  });

  it('styles the 404 page without utility-class names that this app does not load', () => {
    expect(notFound).not.toContain('min-h-screen');
    expect(notFound).toContain('not-found.module.css');
    expect(notFoundCss).toContain('min-height: 70vh');
  });
});
