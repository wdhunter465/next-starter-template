import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// #4467 (#3633-009), gap rows 12, 13, 14, 17, 28, 59 and 85: scheduled qualification of the public
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

// Row 59, focus order. Keyboard users move through a page with Tab, so the order must follow the
// page, never be forced by a positive tabindex, never trap focus, and never land on something that
// cannot be seen. Read-only: it only presses Tab and reads the focused element.
const FOCUS_ROUTES = ['/', '/ask/', '/join/'];
const MAX_TABS = 200;

/** Presses Tab through the open page and returns what is wrong with the focus order (empty is good). */
async function auditFocusOrder(page: Page, { requireFooter = true } = {}): Promise<string[]> {
  const positive = await page.evaluate(() =>
    [...document.querySelectorAll('[tabindex]')]
      .filter((el) => Number(el.getAttribute('tabindex')) > 0)
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  const problems: string[] = positive.map((html) => `a positive tabindex overrides the natural focus order: ${html}`);

  let reachedFooter = false;
  let previousKey = '';
  let leftThePage = false;
  for (let i = 0; i < MAX_TABS; i += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        label: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`,
        // Several links can share one label, so identity is the element's place on the page.
        key: `${el.tagName}|${el.getAttribute('href') ?? ''}|${Math.round(box.left)}|${Math.round(box.top + window.scrollY)}`,
        visible: box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        inFooter: Boolean(el.closest('footer')),
      };
    });
    if (state === null) {
      leftThePage = true; // focus left the page: the end of the cycle, so no trap
      break;
    }
    if (!state.visible) problems.push(`Tab ${i + 1}: focus is on something not visible: ${state.label}`);
    if (state.inFooter) reachedFooter = true;
    if (state.key === previousKey) {
      problems.push(`Tab ${i + 1}: focus did not move off ${state.label}`);
      break;
    }
    previousKey = state.key;
  }
  if (!leftThePage && !problems.some((p) => p.includes('did not move'))) {
    problems.push(`focus never left the page within ${MAX_TABS} presses (a trap or a very long page)`);
  }
  if (requireFooter && !reachedFooter) problems.push('Tab never reached the footer');
  return problems;
}

test.describe('scheduled qualification: keyboard focus order (row 59)', () => {
  for (const route of FOCUS_ROUTES) {
    test(`Tab moves through ${route} in page order without a trap`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const response = await page.goto(route, { waitUntil: 'load' });
      test.skip(!response?.ok(), `${route} is not a public page`);
      // Client-side redirects and the consent banner settle after load; focus is read only after that.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);
      const problems = await auditFocusOrder(page);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  // Failure behavior: the audit has to catch each fault, not only pass on a good page.
  test('the audit passes a page with a sane order', async ({ page }) => {
    await page.setContent('<header><a href="#a">One</a></header><main><button>Two</button></main><footer><a href="#b">Three</a></footer>');
    expect(await auditFocusOrder(page)).toEqual([]);
  });

  test('the audit catches a positive tabindex', async ({ page }) => {
    await page.setContent('<a href="#a">One</a><a href="#b" tabindex="3">Two</a><footer><a href="#c">Three</a></footer>');
    expect((await auditFocusOrder(page)).join('\n')).toContain('positive tabindex');
  });

  test('the audit catches a focus trap', async ({ page }) => {
    await page.setContent(
      '<a id="x" href="#a">One</a><footer><a href="#c">Three</a></footer><script>document.addEventListener("keydown",e=>{if(e.key==="Tab"){e.preventDefault();document.getElementById("x").focus();}})</script>',
    );
    expect((await auditFocusOrder(page, { requireFooter: false })).join('\n')).toMatch(/did not move|never left/);
  });

  test('the audit catches focus landing on something not visible', async ({ page }) => {
    await page.setContent('<a href="#a">One</a><a href="#b" style="position:absolute;width:0;height:0;overflow:hidden">Ghost</a><footer><a href="#c">Three</a></footer>');
    expect((await auditFocusOrder(page)).join('\n')).toContain('not visible');
  });

  test('the audit reports a page whose footer is never reached', async ({ page }) => {
    await page.setContent('<a href="#a">One</a><a href="#b">Two</a>');
    expect((await auditFocusOrder(page)).join('\n')).toContain('never reached the footer');
  });
});
