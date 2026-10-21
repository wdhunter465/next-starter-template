import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// #4467 (#3633-009), gap rows 12, 13, 14, 17, 28 and 85: scheduled qualification of the public
// site and the admin boundary. Run nightly by .github/workflows/ops-scheduled-qualification.yml.
//
// Read-only by design: GET requests only. No sign-in, no form submission, no data written, so it is
// safe against Production. Routes come from the site's own sitemap, so a new public page is covered
// without editing this file.

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const MAX_LINKS_CHECKED = 120;

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('/sitemap.xml');
  expect(res.ok(), 'sitemap.xml should load').toBeTruthy();
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(paths.length, 'sitemap should list the public routes').toBeGreaterThanOrEqual(5);
  return [...new Set(paths)];
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('scheduled qualification: public routes at three widths (rows 12, 14)', () => {
  for (const viewport of VIEWPORTS) {
    test(`every sitemap route loads and fits at ${viewport.name} (${viewport.width}px)`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const failures: string[] = [];
      for (const path of await sitemapPaths(request)) {
        const response = await page.goto(path, { waitUntil: 'load' });
        if (!response?.ok()) {
          failures.push(`${path}: HTTP ${response?.status() ?? 'no response'}`);
          continue;
        }
        if ((await page.locator('header').count()) === 0) failures.push(`${path}: no header`);
        if ((await page.locator('footer').count()) === 0) failures.push(`${path}: no footer`);
        if ((await page.locator('h1').count()) === 0) failures.push(`${path}: no h1`);
        const overflow = await horizontalOverflow(page);
        if (overflow > 1) failures.push(`${path}: page is ${overflow}px wider than the ${viewport.width}px screen`);
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});

test.describe('scheduled qualification: links (row 13)', () => {
  test('every internal link on every sitemap route resolves', async ({ page, request }) => {
    const links = new Set<string>();
    for (const path of await sitemapPaths(request)) {
      await page.goto(path, { waitUntil: 'load' });
      const origin = new URL(page.url()).origin;
      const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin !== origin) continue;
        if (!/^https?:$/.test(url.protocol)) continue;
        links.add(url.pathname + url.search);
      }
    }
    const broken: string[] = [];
    for (const link of [...links].slice(0, MAX_LINKS_CHECKED)) {
      const res = await request.get(link);
      if (res.status() >= 400) broken.push(`${link}: HTTP ${res.status()}`);
    }
    expect(links.size, 'should find internal links to check').toBeGreaterThan(0);
    expect(broken, broken.join('\n')).toEqual([]);
  });
});

test.describe('scheduled qualification: degraded and protected states (rows 17, 28, 85)', () => {
  test('an unknown page returns 404 and still offers a way home', async ({ page }) => {
    const response = await page.goto('/qualification-no-such-page/', { waitUntil: 'load' });
    expect(response?.status()).toBe(404);
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  });

  test('direct access to the admin page does not show admin content to a visitor', async ({ page }) => {
    await page.goto('/admin/', { waitUntil: 'load' });
    await expect(page.getByText(/Member Operations/i)).toHaveCount(0);
    await expect(page.locator('header').getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('admin APIs refuse a request with no credentials', async ({ request }) => {
    for (const path of ['/api/admin/stats', '/api/admin/welcome-email']) {
      const res = await request.get(path);
      expect([401, 403], `${path} should refuse an anonymous request, got ${res.status()}`).toContain(res.status());
    }
  });
});
