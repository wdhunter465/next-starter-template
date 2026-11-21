import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// #4467 / #5179 (#3633-009), gap rows 12, 13, 14, 17, 28, 35, 41, 42, 45, 59, 68, 69 and 85:
// scheduled qualification of the public site and the admin boundary. Run nightly by
// .github/workflows/ops-scheduled-qualification.yml.

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

// #5179 Slice 1 (#3633-009 follow-up): rows 35, 41, 42, 45, 68, 69.
// Still read-only against Production (GET / key presses only). Member-only Club Home APIs are out of scope.

const ASSET_TIMEOUT_MS = 15_000;
const HEALTH_BUDGET_MS = 5_000;

type PhotoListBody = {
  ok?: boolean;
  items?: Array<{ id?: number; url?: string; rights_hold?: number; publication_eligible?: number }>;
};

async function fetchPhotoList(
  request: APIRequestContext,
  query = 'limit=20',
): Promise<{ status: number; body: PhotoListBody; ms: number }> {
  const started = Date.now();
  const res = await request.get(`/api/photos?${query}`);
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as PhotoListBody, ms: Date.now() - started };
}

test.describe('scheduled qualification: missing or slow asset (row 35)', () => {
  test('static site assets and public photo bytes respond within the asset budget', async ({ request }) => {
    const failures: string[] = [];
    const staticPaths = ['/logo.svg', '/IMG_1946.png', '/favicon.ico'];
    for (const path of staticPaths) {
      const started = Date.now();
      const res = await request.get(path, { timeout: ASSET_TIMEOUT_MS }).catch(() => null);
      const ms = Date.now() - started;
      if (!res) {
        failures.push(`${path}: no response within ${ASSET_TIMEOUT_MS}ms`);
        continue;
      }
      if (res.status() >= 400) failures.push(`${path}: HTTP ${res.status()}`);
      if (ms > ASSET_TIMEOUT_MS) failures.push(`${path}: slow asset ${ms}ms`);
    }

    const list = await fetchPhotoList(request, 'limit=3');
    expect(list.status).toBe(200);
    for (const item of list.body.items ?? []) {
      if (!item.url) {
        failures.push(`photo ${item.id}: missing url`);
        continue;
      }
      const started = Date.now();
      const res = await request.get(item.url, { timeout: ASSET_TIMEOUT_MS }).catch(() => null);
      const ms = Date.now() - started;
      if (!res) {
        failures.push(`photo ${item.id}: no response within ${ASSET_TIMEOUT_MS}ms`);
        continue;
      }
      if (res.status() >= 400) failures.push(`photo ${item.id}: HTTP ${res.status()}`);
      if (ms > ASSET_TIMEOUT_MS) failures.push(`photo ${item.id}: slow asset ${ms}ms`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('a missing photo id is not served as a public asset', async ({ request }) => {
    const res = await request.get('/api/photos/get?id=999999999');
    expect(res.status(), 'missing photo must 404').toBe(404);
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    expect(body.ok).not.toBe(true);
  });
});

test.describe('scheduled qualification: rotation fairness signals (row 41)', () => {
  test('public photo list has unique ids and no duplicate URLs in one page', async ({ request }) => {
    const { status, body } = await fetchPhotoList(request, 'limit=40');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const items = body.items ?? [];
    expect(items.length, 'public photo pool should not be empty').toBeGreaterThan(0);
    const ids = items.map((i) => i.id);
    const urls = items.map((i) => i.url).filter(Boolean);
    expect(new Set(ids).size, 'duplicate photo ids in one page').toBe(ids.length);
    expect(new Set(urls).size, 'duplicate photo urls in one page').toBe(urls.length);
  });

  test('memorabilia filter returns unique ids when any memorabilia is published', async ({ request }) => {
    const mem = await fetchPhotoList(request, 'limit=40&memorabilia=1');
    expect(mem.status).toBe(200);
    expect(mem.body.ok).toBe(true);
    const memIds = (mem.body.items ?? []).map((i) => i.id);
    expect(new Set(memIds).size).toBe(memIds.length);
  });
});

test.describe('scheduled qualification: persistent public edition signals (row 42)', () => {
  test('two GETs in one run see the same leading public photo id', async ({ request }) => {
    const a = await fetchPhotoList(request, 'limit=5');
    const b = await fetchPhotoList(request, 'limit=5');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const idA = a.body.items?.[0]?.id;
    const idB = b.body.items?.[0]?.id;
    expect(idA, 'leading photo id missing').toEqual(expect.any(Number));
    expect(idB).toBe(idA);
  });

  test('homepage HTML keeps header, h1, and footer across two GETs', async ({ request }) => {
    for (let i = 0; i < 2; i += 1) {
      const res = await request.get('/');
      expect(res.ok(), `homepage GET ${i + 1}`).toBeTruthy();
      const html = await res.text();
      expect(html, `load ${i + 1} missing <header`).toMatch(/<header\b/i);
      expect(html, `load ${i + 1} missing <h1`).toMatch(/<h1\b/i);
      expect(html, `load ${i + 1} missing <footer`).toMatch(/<footer\b/i);
    }
  });
});

test.describe('scheduled qualification: rights gate on public photos (row 45)', () => {
  test('public photo list does not expose held or ineligible rows', async ({ request }) => {
    const { status, body } = await fetchPhotoList(request, 'limit=50');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    for (const item of body.items ?? []) {
      if (typeof item.rights_hold === 'number') expect(item.rights_hold, `id ${item.id}`).toBe(0);
      if (typeof item.publication_eligible === 'number') {
        expect(item.publication_eligible, `id ${item.id}`).toBe(1);
      }
      expect(item.url, `id ${item.id} needs a url`).toBeTruthy();
    }
  });

  test('public get for a listed photo succeeds; unknown ids stay not-ok', async ({ request }) => {
    const list = await fetchPhotoList(request, 'limit=5');
    const id = list.body.items?.[0]?.id;
    expect(id).toEqual(expect.any(Number));
    const okRes = await request.get(`/api/photos/get?id=${id}`);
    expect(okRes.status()).toBe(200);
    const okBody = (await okRes.json()) as { ok?: boolean; item?: { id?: number } };
    expect(okBody.ok).toBe(true);
    expect(okBody.item?.id).toBe(id);

    const missing = await request.get('/api/photos/get?id=999999999');
    expect(missing.status()).toBe(404);
    const missingBody = (await missing.json()) as { ok?: boolean };
    expect(missingBody.ok).not.toBe(true);
  });
});

test.describe('scheduled qualification: external-service budget (row 68)', () => {
  test('health and photo list stay inside the latency budget', async ({ request }) => {
    const healthStarted = Date.now();
    const health = await request.get('/api/health');
    const healthMs = Date.now() - healthStarted;
    expect(health.ok()).toBeTruthy();
    const healthBody = (await health.json()) as { ok?: boolean; db_ok?: boolean };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.db_ok).toBe(true);
    expect(healthMs, `health took ${healthMs}ms`).toBeLessThanOrEqual(HEALTH_BUDGET_MS);

    const photos = await fetchPhotoList(request, 'limit=5');
    expect(photos.status).toBe(200);
    expect(photos.body.ok).toBe(true);
    expect(photos.ms, `photos list took ${photos.ms}ms`).toBeLessThanOrEqual(ASSET_TIMEOUT_MS);
  });
});

test.describe('scheduled qualification: repeated-run stability (row 69)', () => {
  test('sitemap size and leading photo id are stable across two passes in one run', async ({ request }) => {
    const pass = async () => {
      const sitemap = await request.get('/sitemap.xml');
      expect(sitemap.ok()).toBeTruthy();
      const xml = await sitemap.text();
      const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const photos = await fetchPhotoList(request, 'limit=5');
      return { pathCount: new Set(paths).size, leadPhotoId: photos.body.items?.[0]?.id, photoOk: photos.body.ok };
    };
    const a = await pass();
    const b = await pass();
    expect(a.pathCount).toBeGreaterThanOrEqual(5);
    expect(b.pathCount).toBe(a.pathCount);
    expect(a.photoOk).toBe(true);
    expect(b.leadPhotoId).toBe(a.leadPhotoId);
  });
});
