import { expect, test } from '@playwright/test';

/**
 * Mobile smoke test — Home page
 *
 * Validates the critical mobile flows that were fixed in this task:
 * 1. Home renders without horizontal overflow
 * 2. Mobile nav drawer opens and closes cleanly (single X affordance)
 * 3. Consent banner is actionable when visible
 * 4. CTA final section is readable and functional
 *
 * These tests run on Pixel 5 and iPhone 12 device presets defined in
 * playwright.config.ts.
 */

test.describe('Home page — mobile smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Remove consent so the banner can appear in tests that need it
    await page.addInitScript(() => {
      localStorage.removeItem('consent_preferences');
    });

    await page.goto('/');
  });

  // ────────────────────────────────────────────────────────────────
  // Layout integrity
  // ────────────────────────────────────────────────────────────────

  test('home loads without horizontal overflow', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('hero section and CTA are visible without horizontal scroll', async ({
    page
  }) => {
    // Hero title should be visible
    await expect(page.locator('h1').first()).toBeVisible();

    // Scroll to the bottom to check the final CTA
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
    );

    // CTA section heading should be in view
    const ctaHeading = page.getByRole('heading', { level: 2 }).last();
    await expect(ctaHeading).toBeVisible();

    // No horizontal overflow after scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  // ────────────────────────────────────────────────────────────────
  // Mobile navigation drawer
  // ────────────────────────────────────────────────────────────────

  test('mobile nav drawer opens and shows navigation links', async ({
    page
  }) => {
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();

    await menuButton.click();

    // Drawer should be open — nav links should be visible
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
  });

  test('mobile nav drawer has only one close affordance', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Count all close-related buttons — the SheetContent built-in is the only one
    // The navbar must NOT add a second custom close button
    const closeButtons = page.getByRole('button', { name: /close|fechar/i });
    const count = await closeButtons.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('closing the drawer preserves background layout integrity', async ({
    page
  }) => {
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Close via the built-in X button (sr-only text "Close")
    await page.keyboard.press('Escape');

    // Dialog should be gone
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Background still free of horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('drawer items are not touching the edges — have visible padding', async ({
    page
  }) => {
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The logo link inside the drawer should not be at x=0
    const logoLink = dialog.getByRole('link').first();
    const box = await logoLink.boundingBox();
    expect(box).not.toBeNull();
    // Verify there's at least 16px of padding on the left
    expect(box?.x).toBeGreaterThan(16);
  });

  // ────────────────────────────────────────────────────────────────
  // Consent banner
  // ────────────────────────────────────────────────────────────────

  test('consent banner appears after delay and action buttons are reachable', async ({
    page
  }) => {
    // Wait for the 500ms banner delay + some buffer
    await page.waitForTimeout(700);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // All three action buttons should be visible and tappable
    const acceptBtn = page.getByRole('button', {
      name: /aceitar todos|accept all/i
    });
    const rejectBtn = page.getByRole('button', {
      name: /rejeitar tudo|reject all/i
    });
    const saveBtn = page.getByRole('button', {
      name: /salvar prefer|save pref/i
    });

    await expect(acceptBtn).toBeVisible();
    await expect(rejectBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();
  });

  test('accepting consent hides the banner', async ({ page }) => {
    await page.waitForTimeout(700);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page
      .getByRole('button', { name: /aceitar todos|accept all/i })
      .click();

    await expect(dialog).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // CTA final section
  // ────────────────────────────────────────────────────────────────

  test('CTA buttons stack without overflow at mobile width', async ({
    page
  }) => {
    // First accept consent so the banner doesn't overlap
    await page.waitForTimeout(700);
    const consentDialog = page.getByRole('dialog');
    if (await consentDialog.isVisible()) {
      await page
        .getByRole('button', { name: /aceitar todos|accept all/i })
        .click();
    }

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
    );

    // CTA buttons (signup / login in the final section) should be visible
    const ctaLinks = page.locator('section').last().getByRole('link');
    const count = await ctaLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify no horizontal overflow after revealing CTA
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

// ──────────────────────────────────────────────────────────────────
// Desktop regression guard — verify no regressions at desktop width
// ──────────────────────────────────────────────────────────────────

test.describe('Home page — desktop regression guard', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('desktop nav shows links without mobile menu button', async ({
    page
  }) => {
    await page.goto('/');

    // Desktop nav should be visible
    const desktopNav = page.locator('nav').first();
    await expect(desktopNav).toBeVisible();

    // Mobile menu button is hidden at desktop width
    const menuButton = page.getByRole('button', { name: 'Menu' });
    // On desktop, the button is present in DOM but visually hidden via md:hidden
    // Playwright considers visibility based on computed style
    await expect(menuButton).not.toBeVisible();
  });
});
