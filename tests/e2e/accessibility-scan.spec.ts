import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Prototype for #3165 (feeds #2858/#2859). Scans a small representative set of
// public routes, matching the routes named in #3165's own scope.
// Design notes: docs/ops/reports/accessibility-scan-prototype-design-3165.md
//
// Production static hosting redirects bare paths to trailing-slash URLs (308).
// Scan the settled trailing-slash forms and wait for load before axe so
// analyze() does not race a destroyed browsing context (#1806).

const SCANNED_ROUTES = ['/', '/search/', '/join/', '/faq/', '/about/'] as const;

// "Critical/serious" per #3165's acceptance criteria; moderate/minor are recorded
// as advisory evidence, not asserted against, so this spec doesn't silently start
// failing on cosmetic findings unrelated to what was scoped here.
const BLOCKING_IMPACTS = ['critical', 'serious'] as const;

async function scanRoute(page: Page, route: string, testInfo: TestInfo) {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response?.ok(), `expected ${route} to load successfully`).toBeTruthy();
  await page.waitForLoadState('domcontentloaded');
  // Ensure the document URL has finished any trailing-slash redirect before axe.
  await expect.poll(() => page.url()).toMatch(new RegExp(`${route.replace(/\/$/, '')}/?$`));

  const results = await new AxeBuilder({ page }).analyze();

  await testInfo.attach(`axe-results-${route.replace(/\//g, '_') || 'root'}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  const blockingViolations = results.violations.filter((violation) =>
    BLOCKING_IMPACTS.includes(violation.impact as (typeof BLOCKING_IMPACTS)[number]),
  );

  if (blockingViolations.length > 0) {
    const summary = blockingViolations
      .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`Critical/serious accessibility violations found on ${route}:\n${summary}`);
  }

  // Non-blocking findings are recorded as evidence (see the JSON attachment) rather
  // than asserted against here — remediation is separate, routed work per #3165.
}

test.describe('automated accessibility scan (#3165 prototype)', () => {
  for (const route of SCANNED_ROUTES) {
    test(`${route} has no critical or serious accessibility violations`, async ({ page }, testInfo) => {
      await scanRoute(page, route, testInfo);
    });
  }
});
