import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import {
  buildHomeStructuredData,
  DEFAULT_SITE_METADATA,
  PUBLIC_SITEMAP_ROUTES,
  SITE_URL,
} from '@/lib/publicSiteMetadata';

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

  it('describes the organization and website in home page structured data (#4733)', () => {
    const data = buildHomeStructuredData();
    const byType = Object.fromEntries(data.map((item) => [item['@type'], item]));
    expect(byType.Organization).toMatchObject({
      '@context': 'https://schema.org',
      name: 'Lou Gehrig Fan Club',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/logo.svg`,
    });
    expect(byType.WebSite).toMatchObject({ name: 'Lou Gehrig Fan Club', url: `${SITE_URL}/` });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    for (const item of data) {
      expect(item).not.toHaveProperty('potentialAction');
      expect(item).not.toHaveProperty('sameAs');
    }
  });

  it('sets a canonical on the home page and on every sitemap route (#4732)', async () => {
    const modules: Record<string, () => Promise<{ metadata?: Metadata }>> = {
      '/about/': () => import('@/app/about/layout'),
      '/accessibility/': () => import('@/app/accessibility/layout'),
      '/ask/': () => import('@/app/ask/layout'),
      '/contact/': () => import('@/app/contact/layout'),
      '/events/': () => import('@/app/events/layout'),
      '/join/': () => import('@/app/join/page'),
      '/privacy/': () => import('@/app/privacy/page'),
      '/search/': () => import('@/app/search/layout'),
      '/terms/': () => import('@/app/terms/page'),
    };
    expect(DEFAULT_SITE_METADATA.alternates?.canonical).toBe(`${SITE_URL}/`);
    for (const route of PUBLIC_SITEMAP_ROUTES) {
      if (route === '/') continue;
      const load = modules[route];
      expect(load, `no metadata module mapped for ${route}`).toBeDefined();
      const mod = await load();
      expect(mod.metadata?.alternates?.canonical).toBe(`${SITE_URL}${route}`);
    }
    const fundraiser = await import('@/app/fundraiser-details/layout');
    expect(fundraiser.metadata.alternates?.canonical).toBe(`${SITE_URL}/fundraiser-details/`);
  });
});
