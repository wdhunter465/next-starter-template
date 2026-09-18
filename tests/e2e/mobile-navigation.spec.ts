import { expect, test, type Page } from '@playwright/test';

const STORE_URL = 'https://www.bonfire.com/store/lou-gehrig-fan-club/';

const publicGuestItems = ['Join', 'Search', 'Store', 'Login', 'About', 'Contact'];
// Must match HAMBURGER_MENU_ITEMS.fanclub labels (src/components/HamburgerMenu.tsx).
const fanclubItems = [
  'Club Home',
  'My Profile',
  'Photo',
  'Library',
  'Memorabilia',
  'Chat',
  'Submit',
  'Search',
  'Store',
  'Logout',
  'About',
  'Contact',
];

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function mockMemberSession(page: Page) {
  await page.route('**/api/session/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, email: 'fan@example.com', role: 'member' }),
    });
  });
}

async function openHamburger(page: Page) {
  const button = page.getByRole('button', { name: 'Open menu' }).first();
  await expect(button).toBeVisible();

  const box = await button.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await button.click();
  return page.getByRole('dialog', { name: 'Menu' });
}

test.describe('public mobile navigation responsiveness', () => {
  test('uses hamburger-only public navigation on mobile without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');

    const header = page.locator('header').first();
    await expect(header.getByRole('link', { name: 'Join' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Search' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Store' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Login' })).toBeHidden();
    await assertNoHorizontalOverflow(page);

    const menu = await openHamburger(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link')).toHaveText(publicGuestItems);
    await expect(menu.getByRole('link', { name: 'Store' })).toHaveAttribute('href', STORE_URL);
    await expect(menu.getByRole('link', { name: 'Store' })).toHaveAttribute('target', '_blank');
    await expect(menu.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Support' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Members' })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open menu' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
  });

  for (const width of [768, 920, 1280]) {
    test(`keeps public desktop/tablet buttons visible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const header = page.locator('header').first();
      await expect(header.getByRole('link', { name: 'Join' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Search' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Store' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Login' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});

test.describe('fanclub mobile navigation responsiveness', () => {
  test('uses hamburger-only member navigation on mobile without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await mockMemberSession(page);
    await page.goto('/fanclub');

    const header = page.locator('header').first();
    await expect(header.getByRole('link', { name: 'Club Home' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'My Profile' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Search' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Store' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Logout' })).toBeHidden();
    await assertNoHorizontalOverflow(page);

    const menu = await openHamburger(page);
    await expect(menu.getByRole('link')).toHaveText(fanclubItems);
    await expect(menu.getByRole('link', { name: 'Store' })).toHaveAttribute('href', STORE_URL);
    await expect(menu.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Support' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Members' })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open menu' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
  });

  for (const width of [768, 920, 1280]) {
    test(`keeps fanclub desktop/tablet buttons visible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockMemberSession(page);
      await page.goto('/fanclub');

      const header = page.locator('header').first();
      await expect(header.getByRole('link', { name: 'Club Home' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'My Profile' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Search' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Store' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Logout' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});

test.describe('footer responsive invariants', () => {
  test('keeps the locked footer links and two-row right column on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', /\/privacy\/?$/);
    await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', /\/terms\/?$/);
    await expect(footer.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', /\/contact\/?$/);
    await expect(footer.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Support' })).toHaveCount(0);
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(footer.getByRole('button', { name: 'Back to top' })).toBeVisible();

    // Homepage content can still grow after load. Scroll the footer into view and
    // sample Privacy/Terms/Contact in one layout frame; retry until settled.
    // Keep the locked thresholds (delta <= 2, Contact below Privacy by > 8).
    await footer.scrollIntoViewIfNeeded();
    await expect(async () => {
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('footer');
        if (!root) {
          throw new Error('footer missing during geometry sample');
        }
        const privacy = root.querySelector('a[href*="privacy"]');
        const terms = root.querySelector('a[href*="terms"]');
        const contact = root.querySelector('a[href*="contact"]');
        if (!privacy || !terms || !contact) {
          throw new Error('footer links missing during geometry sample');
        }
        const privacyBox = privacy.getBoundingClientRect();
        const termsBox = terms.getBoundingClientRect();
        const contactBox = contact.getBoundingClientRect();
        return {
          privacyTermsDelta: Math.abs(privacyBox.y - termsBox.y),
          contactBelowPrivacy: contactBox.y - privacyBox.y,
        };
      });

      expect(geometry.privacyTermsDelta).toBeLessThanOrEqual(2);
      expect(geometry.contactBelowPrivacy).toBeGreaterThan(8);
    }).toPass({ timeout: 10_000 });

    await assertNoHorizontalOverflow(page);
  });
});
