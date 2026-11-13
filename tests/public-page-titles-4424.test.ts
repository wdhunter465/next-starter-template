import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_SITEMAP_ROUTES } from '../src/lib/publicSiteMetadata';

// #5233: every public sitemap route must set a page title. The home page uses the site default title.
function sourceFor(route: string): string[] {
  const dir = route === '/' ? 'src/app' : `src/app${route.replace(/\/$/, '')}`;
  return [`${dir}/layout.tsx`, `${dir}/page.tsx`];
}

describe('public page titles (#5233)', () => {
  const routes = PUBLIC_SITEMAP_ROUTES.filter((route) => route !== '/');

  it.each(routes)('%s sets a page title with buildPublicPageMetadata', (route) => {
    const texts = sourceFor(route).flatMap((file) => {
      try {
        return [readFileSync(file, 'utf8')];
      } catch {
        return [];
      }
    });
    const joined = texts.join('\n');
    const bareCanonicalOnly = /buildCanonicalMetadata\(/.test(joined) && !/buildPublicPageMetadata\(/.test(joined);
    expect(bareCanonicalOnly).toBe(false);
    expect(joined).toMatch(/buildPublicPageMetadata\(|title:\s*['"]/);
  });

  it('gives /join, /privacy and /terms the titles the launch check expects', () => {
    const expected: Record<string, string> = { '/join/': 'Join', '/privacy/': 'Privacy', '/terms/': 'Terms' };
    for (const [route, title] of Object.entries(expected)) {
      const joined = sourceFor(route).map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
      expect(joined).toContain(`title: '${title}'`);
    }
  });
});
