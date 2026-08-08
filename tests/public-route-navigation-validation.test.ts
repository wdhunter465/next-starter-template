import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import manifest from '../scripts/launch-readiness/manifest.json';

const PUBLIC_CORE_ROUTES = [
  '/',
  '/about',
  '/ask',
  '/auth',
  '/contact',
  '/events',
  '/faq',
  '/health',
  '/join',
  '/login',
  '/logout',
  '/privacy',
  '/search',
  '/terms',
] as const;

/** Required public-core routes intentionally excluded from Playwright public suite. */
const PLAYWRIGHT_EXCLUDED_PUBLIC_ROUTES: Record<string, string> = {
  '/auth': 'legacy redirect to /join',
  '/faq': 'legacy redirect to /ask (Ask/FAQ consolidated)',
  '/health': 'ops health probe; minimal shell without full public nav contract',
  '/logout': 'client POST /api/logout flow; not a static browse target',
};

function routePagePath(route: string): string {
  const segments = route === '/' ? [] : route.replace(/^\//, '').split('/');
  const basePath = join('src', 'app', ...segments, 'page');
  return existsSync(`${basePath}.ts`) ? `${basePath}.ts` : `${basePath}.tsx`;
}

describe('public route contract (#1259 Task 002)', () => {
  it('maps every canonical public-core route to a page file', () => {
    const missing = PUBLIC_CORE_ROUTES.filter((route) => !existsSync(routePagePath(route)));
    expect(missing, `Missing page files: ${missing.join(', ')}`).toEqual([]);
  });

  it('lists every required public-core route in the launch manifest', () => {
    const required = new Set(manifest.requiredRoutes);
    const missing = PUBLIC_CORE_ROUTES.filter((route) => !required.has(route));
    expect(missing, `Add to manifest requiredRoutes: ${missing.join(', ')}`).toEqual([]);
  });

  it('documents Playwright exclusions for required public routes', () => {
    const playwright = new Set(manifest.publicPlaywrightRoutes);
    const excluded = PUBLIC_CORE_ROUTES.filter((route) => !playwright.has(route));
    expect(excluded.sort()).toEqual(Object.keys(PLAYWRIGHT_EXCLUDED_PUBLIC_ROUTES).sort());
  });

  it('keeps forbidden routes out of the app tree', () => {
    for (const route of manifest.forbiddenRoutes || []) {
      expect(existsSync(routePagePath(route))).toBe(false);
    }
  });

  it('aligns manifest footer links with locked footer contract', () => {
    const required = manifest.footerLinks?.required || [];
    expect(required.map((entry) => entry.label)).toEqual(['Privacy', 'Terms', 'Contact']);
    expect(required.map((entry) => entry.target.replace(/\/$/, ''))).toEqual([
      '/privacy',
      '/terms',
      '/contact',
    ]);
  });

  it('renders health probe marker for /health', () => {
    const path = routePagePath('/health');
    expect(existsSync(path), `Missing page file: ${path}`).toBe(true);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('OK: health');
  });

  it('keeps legacy /login redirect wired to post-logout home route', () => {
    const path = routePagePath('/login');
    expect(existsSync(path), `Missing page file: ${path}`).toBe(true);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('POST_LOGOUT_ROUTE');
    expect(source).toContain('window.location.replace');
  });

  it('keeps legacy /faq redirect wired to consolidated /ask route', () => {
    const path = routePagePath('/faq');
    expect(existsSync(path), `Missing page file: ${path}`).toBe(true);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('/ask/');
    expect(source).toContain('window.location.replace');
  });
});
