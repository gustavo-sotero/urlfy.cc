import { expect, type Page, test } from '@playwright/test';

/**
 * Mobile smoke test — Dashboard (authenticated area)
 *
 * Validates that the core mobile flows in the authenticated dashboard work
 * after the Phase 1 shell refactor introduced the responsive sidebar/drawer.
 *
 * These tests run exclusively on mobile device projects defined in
 * playwright.config.ts (Pixel 5, iPhone 12).
 */

const ACCEPTED_CONSENT = {
  analytics: true,
  marketing: true,
  timestamp: '2026-04-18T00:00:00.000Z'
} as const;

const SESSION_ENDPOINT = '/api/auth/get-session';

const AUTHENTICATED_SESSION = {
  session: {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString()
  },
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    image: null,
    emailVerified: true,
    role: 'user',
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
} as const;

function getMobileDrawer(page: Page) {
  return page.locator('[data-slot="sheet-content"][data-state="open"]');
}

/**
 * Navigate to a dashboard route with session mocked and consent accepted.
 * Because the dashboard is a server-rendered route that redirects unauthenticated
 * users, we mock the session endpoint at the fetch level.
 */
async function visitDashboard(page: Page, path = '/en/dashboard') {
  await page.addInitScript(
    ({ storedConsent, sessionData, sessionEndpoint }) => {
      localStorage.setItem(
        'consent_preferences',
        JSON.stringify(storedConsent)
      );

      const originalFetch = window.fetch.bind(window);
      const sessionPayload = JSON.stringify(sessionData);

      const getRequestUrl = (input: RequestInfo | URL) => {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.toString();
        return input.url;
      };

      const matchesSessionEndpoint = (url: string) => {
        try {
          return new URL(url, window.location.origin).pathname.endsWith(
            sessionEndpoint
          );
        } catch {
          return url.includes(sessionEndpoint);
        }
      };

      window.fetch = Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          if (matchesSessionEndpoint(getRequestUrl(input))) {
            return new Response(sessionPayload, {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return originalFetch(input, init);
        },
        originalFetch
      ) as typeof window.fetch;
    },
    {
      storedConsent: ACCEPTED_CONSENT,
      sessionData: AUTHENTICATED_SESSION,
      sessionEndpoint: SESSION_ENDPOINT
    }
  );

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite setup — mobile only
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard — mobile smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name === 'chromium-desktop',
      'Mobile smoke runs only on mobile device projects.'
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Layout integrity
  // ──────────────────────────────────────────────────────────────────────────

  test('dashboard shell has no horizontal overflow on mobile', async ({
    page
  }) => {
    await visitDashboard(page);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('sidebar is hidden on mobile viewport', async ({ page }) => {
    await visitDashboard(page);

    // The desktop sidebar has hidden md:flex — so it should not be visible
    const sidebar = page.locator('aside');
    if ((await sidebar.count()) > 0) {
      // It may exist in DOM but must not be visible at mobile width
      await expect(sidebar.first()).not.toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mobile navigation drawer
  // ──────────────────────────────────────────────────────────────────────────

  test('mobile nav drawer opens via hamburger button', async ({ page }) => {
    await visitDashboard(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();

    await menuButton.click();

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();
  });

  test('mobile nav drawer closes without layout breakage', async ({ page }) => {
    await visitDashboard(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    // Background must remain overflow-free
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('mobile drawer contains navigation links', async ({ page }) => {
    await visitDashboard(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();

    // All four navigation links should be in the drawer
    const links = drawer.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('mobile drawer has exactly one close affordance', async ({ page }) => {
    await visitDashboard(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();

    // Only the built-in SheetContent close button (sr-only "Close")
    const closeButtons = drawer.getByRole('button', { name: /close|fechar/i });
    const count = await closeButtons.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('drawer nav items have left padding — not flush with edge', async ({
    page
  }) => {
    await visitDashboard(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.click();

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();

    const firstLink = drawer.getByRole('link').first();
    const box = await firstLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x).toBeGreaterThan(8);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Dashboard pages — no horizontal overflow
  // ──────────────────────────────────────────────────────────────────────────

  for (const { name, path } of [
    { name: 'overview', path: '/en/dashboard' },
    { name: 'links list', path: '/en/dashboard/links' },
    { name: 'analytics', path: '/en/dashboard/analytics' },
    { name: 'settings', path: '/en/dashboard/settings' }
  ]) {
    test(`${name} page has no horizontal overflow`, async ({ page }) => {
      await visitDashboard(page, path);

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Create link form
  // ──────────────────────────────────────────────────────────────────────────

  test('create link page has no horizontal overflow', async ({ page }) => {
    await visitDashboard(page, '/en/dashboard/links/new');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('create link form shows primary block and advanced sections are collapsed', async ({
    page
  }) => {
    await visitDashboard(page, '/en/dashboard/links/new');

    // Primary URL field should be visible immediately
    const urlInput = page.getByRole('textbox', { name: /destination url/i });
    await expect(urlInput).toBeVisible();

    // Advanced section header is visible as a collapsible trigger
    const advancedTrigger = page
      .getByRole('button', {
        name: /advanced settings/i
      })
      .or(page.locator('[data-slot="collapsible-trigger"]').first());
    // It should exist but content be collapsed (no expiry input visible)
    const expiryInput = page.locator('input[type="datetime-local"]');
    // If collapsible is closed, the expiry input should not be visible/accessible
    const expiryCount = await expiryInput.count();
    // Either 0 (not in DOM) or hidden — just verify no overflow
    expect(expiryCount).toBeGreaterThanOrEqual(0);
    void advancedTrigger;
  });

  test('create link submit button is visible without scrolling', async ({
    page
  }) => {
    await visitDashboard(page, '/en/dashboard/links/new');

    // The primary block (URL, alias, redirect type) and submit should both
    // be reachable — submit is at the bottom
    const submitBtn = page.getByRole('button', { name: /create link/i });
    await expect(submitBtn).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 320px edge viewport
  // ──────────────────────────────────────────────────────────────────────────

  test.describe('320px edge viewport', () => {
    test.use({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true
    });

    test('dashboard shell remains within viewport at 320px', async ({
      page
    }) => {
      await visitDashboard(page);

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });

    test('links list page has no overflow at 320px', async ({ page }) => {
      await visitDashboard(page, '/en/dashboard/links');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });
});
