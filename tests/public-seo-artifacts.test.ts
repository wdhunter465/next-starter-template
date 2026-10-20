import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { PUBLIC_SITEMAP_ROUTES, SITE_URL } from '@/lib/publicSiteMetadata';

describe('public SEO artifacts (#2046)', () => {
  it('lists core public routes in the sitemap', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    for (const route of PUBLIC_SITEMAP_ROUTES) {
      const expected = route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}`;
      expect(urls).toContain(expected);
    }
  });

  it('does not list the /faq redirect or the /login page (#4615, D-062)', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).not.toContain(`${SITE_URL}/faq/`);
    expect(urls).not.toContain(`${SITE_URL}/login/`);
  });

  it('disallows member and admin paths in robots.txt', () => {
    const rules = robots();
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(rules.rules).toMatchObject({
      disallow: ['/admin/', '/fanclub/', '/api/', '/_ai-review/'],
    });
  });

  it('gives each sitemap entry its own valid, non-future lastModified date (#4734)', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(PUBLIC_SITEMAP_ROUTES.length);
    const now = Date.now();
    for (const entry of entries) {
      const time = new Date(entry.lastModified as Date).getTime();
      expect(Number.isNaN(time), `${entry.url} has an invalid date`).toBe(false);
      expect(time, `${entry.url} is dated in the future`).toBeLessThanOrEqual(now);
    }
    const distinct = new Set(entries.map((entry) => new Date(entry.lastModified as Date).toISOString()));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
