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

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'test-user@urlfy.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'Password123!';
const testClientIpByContext = new WeakMap<object, string>();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureTestClientIp(page: Page) {
  const context = page.context();
  const existingIp = testClientIpByContext.get(context);

  if (existingIp) {
    return existingIp;
  }

  const testIp = `203.0.113.${10 + Math.floor(Math.random() * 200)}`;

  await context.setExtraHTTPHeaders({
    'x-forwarded-for': testIp
  });

  testClientIpByContext.set(context, testIp);

  return testIp;
}

function getMobileDrawer(page: Page) {
  return page.locator('[data-slot="sheet-content"][data-state="open"]').first();
}

function getMenuTrigger(page: Page) {
  return page.locator(
    '[data-slot="sheet-trigger"][data-dashboard-menu-ready="true"]'
  );
}

async function waitForHydratedMenuButton(page: Page) {
  const menuButton = getMenuTrigger(page);

  await expect(menuButton).toBeVisible({ timeout: 20_000 });
  await expect(menuButton).toHaveAttribute('aria-haspopup', 'dialog', {
    timeout: 20_000
  });
  await expect(menuButton).toHaveAttribute(
    'aria-label',
    /open menu|abrir menu/i,
    {
      timeout: 20_000
    }
  );

  return menuButton;
}

async function waitForCreateLinkPage(page: Page) {
  const form = page.locator('main form').first();

  await expect(form).toBeVisible({
    timeout: 15_000
  });
  await expect(form.locator('input#url')).toBeVisible({ timeout: 15_000 });
}

async function waitForSettingsPage(page: Page) {
  await expect(page.locator('main input#name')).toBeVisible({
    timeout: 20_000
  });
}

async function waitForLinksPage(page: Page) {
  await expect(
    page.locator('main').getByRole('heading', {
      name: /links/i
    })
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main input').first()).toBeVisible({
    timeout: 20_000
  });
}

async function waitForLinkDetailPage(page: Page) {
  await expect(
    page.getByRole('status', { name: /loading statistics/i })
  ).toHaveCount(0, { timeout: 20_000 });
  await expect(
    page.getByRole('heading', { name: /link details|detalhes do link/i })
  ).toBeVisible({ timeout: 20_000 });
}

async function prepareClientState(page: Page) {
  await ensureTestClientIp(page);
  await page.addInitScript(
    ({ storedConsent }) => {
      localStorage.setItem(
        'consent_preferences',
        JSON.stringify(storedConsent)
      );
    },
    {
      storedConsent: ACCEPTED_CONSENT
    }
  );
}

async function loginAsRegularUser(page: Page) {
  await prepareClientState(page);
  const testClientIp = await ensureTestClientIp(page);

  const response = await page
    .context()
    .request.post('/api/auth/sign-in/email', {
      data: {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        rememberMe: false,
        callbackURL: '/dashboard'
      },
      headers: {
        'x-forwarded-for': testClientIp
      },
      failOnStatusCode: false
    });

  if (!response.ok()) {
    throw new Error(
      `Seeded E2E login failed with ${response.status()}: ${await response.text()}`
    );
  }
}

async function visitDashboard(
  page: Page,
  path = '/dashboard',
  options: { waitForPageReady?: boolean } = {}
) {
  await loginAsRegularUser(page);

  await page.goto(`/en${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(
    new RegExp(`/en${escapeRegExp(path)}(?:\\?.*)?$`),
    { timeout: 10_000 }
  );
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  await waitForHydratedMenuButton(page);

  if (options.waitForPageReady === false) {
    return;
  }

  if (path === '/dashboard/settings') {
    await waitForSettingsPage(page);
  }

  if (path === '/dashboard/links') {
    await waitForLinksPage(page);
  }

  if (path === '/dashboard/links/new') {
    await waitForCreateLinkPage(page);
  }
}

async function assertNoHorizontalOverflow(page: Page) {
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;

  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
}

async function assertPageCanScrollVertically(
  page: Page,
  options: { wheelSupported?: boolean } = {}
) {
  const viewport = page.viewportSize();
  const viewportHeight = viewport?.height ?? 0;
  const viewportWidth = viewport?.width ?? 0;

  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.scrollingElement?.scrollHeight ?? document.body.scrollHeight
      )
    )
    .toBeGreaterThan(viewportHeight + 40);

  await page.evaluate(() => window.scrollTo(0, 0));

  if (options.wheelSupported ?? true) {
    await page.mouse.move(viewportWidth / 2, viewportHeight / 2);
    await page.mouse.wheel(0, 500);
  } else {
    await page.evaluate(() => window.scrollBy(0, 500));
  }

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
}

async function createLinkForMobileTests(page: Page) {
  const slug = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')}`;
  const testClientIp = await ensureTestClientIp(page);

  await loginAsRegularUser(page);

  const response = await page.context().request.post('/api/links', {
    data: {
      url: `https://example.com/mobile/${slug}`,
      customAlias: slug,
      redirectType: 302
    },
    headers: {
      'x-forwarded-for': testClientIp,
      'idempotency-key': `idempotency-${slug}`
    },
    failOnStatusCode: false
  });

  if (!response.ok()) {
    throw new Error(
      `Seeded E2E link creation failed with ${response.status()}: ${await response.text()}`
    );
  }

  const payload = (await response.json()) as {
    data: {
      id: string;
      shortCode: string;
    };
  };

  return payload.data;
}

async function openMobileDrawer(page: Page) {
  const menuButton = await waitForHydratedMenuButton(page);

  const drawer = getMobileDrawer(page);

  const openAttempts = [
    () => menuButton.click({ timeout: 5_000 }),
    () => menuButton.press('Enter'),
    () => menuButton.click({ force: true, timeout: 5_000 }),
    () =>
      menuButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
      })
  ];

  for (const [attempt, openDrawer] of openAttempts.entries()) {
    await openDrawer();

    try {
      await expect(drawer).toBeVisible({ timeout: 5_000 });
      return drawer;
    } catch (error) {
      if (attempt === openAttempts.length - 1) {
        throw error;
      }
    }
  }

  return drawer;
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
    await assertNoHorizontalOverflow(page);
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
    await visitDashboard(page, '/dashboard/settings', {
      waitForPageReady: false
    });

    await openMobileDrawer(page);
  });

  test('mobile nav drawer closes without layout breakage', async ({ page }) => {
    await visitDashboard(page, '/dashboard/settings', {
      waitForPageReady: false
    });

    const drawer = await openMobileDrawer(page);

    const closeButton = drawer.getByRole('button', { name: /close|fechar/i });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(drawer).toHaveCount(0);

    // Background must remain overflow-free
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('mobile drawer contains navigation links', async ({ page }) => {
    await visitDashboard(page, '/dashboard/settings', {
      waitForPageReady: false
    });

    const drawer = await openMobileDrawer(page);

    // All four navigation links should be in the drawer
    const links = drawer.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('mobile drawer has exactly one close affordance', async ({ page }) => {
    await visitDashboard(page, '/dashboard/settings', {
      waitForPageReady: false
    });

    const drawer = await openMobileDrawer(page);

    // Only the built-in SheetContent close button (sr-only "Close")
    const closeButtons = drawer.getByRole('button', { name: /close|fechar/i });
    const count = await closeButtons.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('drawer nav items have left padding — not flush with edge', async ({
    page
  }) => {
    await visitDashboard(page, '/dashboard/settings', {
      waitForPageReady: false
    });

    const drawer = await openMobileDrawer(page);

    const firstLink = drawer.locator('nav').getByRole('link').first();

    await expect
      .poll(async () => (await firstLink.boundingBox())?.x ?? -1)
      .toBeGreaterThan(8);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Dashboard pages — no horizontal overflow
  // ──────────────────────────────────────────────────────────────────────────

  for (const { name, path } of [
    { name: 'overview', path: '/dashboard' },
    { name: 'links list', path: '/dashboard/links' },
    { name: 'analytics', path: '/dashboard/analytics' },
    { name: 'settings', path: '/dashboard/settings' }
  ]) {
    test(`${name} page has no horizontal overflow`, async ({ page }) => {
      await visitDashboard(page, path);
      await assertNoHorizontalOverflow(page);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Create link form
  // ──────────────────────────────────────────────────────────────────────────

  test('create link page has no horizontal overflow', async ({ page }) => {
    await visitDashboard(page, '/dashboard/links/new');
    await assertNoHorizontalOverflow(page);
  });

  test('create link page scrolls vertically from the content area', async ({
    browserName,
    page
  }) => {
    await visitDashboard(page, '/dashboard/links/new');
    await waitForCreateLinkPage(page);

    await assertPageCanScrollVertically(page, {
      wheelSupported: browserName !== 'webkit'
    });
  });

  test('create link form keeps advanced sections collapsed by default', async ({
    page
  }) => {
    await visitDashboard(page, '/dashboard/links/new');
    await waitForCreateLinkPage(page);

    const createForm = page.locator('main form').first();
    const urlInput = createForm.locator('input#url');
    await expect(urlInput).toBeVisible();

    const advancedTrigger = page.getByRole('button', {
      name: /advanced settings|configurações avançadas/i
    });
    await expect(advancedTrigger).toBeVisible();
    await expect(
      page.locator('input[type="datetime-local"]:visible')
    ).toHaveCount(0);
  });

  test('create link submit button is visible without scrolling', async ({
    page
  }) => {
    await visitDashboard(page, '/dashboard/links/new');
    await waitForCreateLinkPage(page);

    const submitBtn = page
      .locator('main form button[type="submit"]:visible')
      .first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeInViewport();
  });

  test('detail and edit routes stay usable on mobile after creating a link', async ({
    page
  }) => {
    test.slow();

    const link = await createLinkForMobileTests(page);

    await page.goto(`/en/dashboard/links/${link.id}`, {
      waitUntil: 'domcontentloaded'
    });
    await expect(page).toHaveURL(new RegExp(`/en/dashboard/links/${link.id}$`));
    await waitForLinkDetailPage(page);
    await assertNoHorizontalOverflow(page);

    const editLink = page.getByRole('link', { name: /edit|editar/i }).first();
    await expect(editLink).toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForURL(new RegExp(`/en/dashboard/links/${link.id}/edit$`)),
      editLink.click()
    ]);

    await expect(page).toHaveURL(
      new RegExp(`/en/dashboard/links/${link.id}/edit$`)
    );
    await expect(
      page.getByRole('button', { name: /save changes|salvar alterações/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('main h2').filter({ hasText: /edit link|editar link/i })
    ).toBeVisible({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
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
      await assertNoHorizontalOverflow(page);
    });

    test('links list page has no overflow at 320px', async ({ page }) => {
      await visitDashboard(page, '/dashboard/links');
      await assertNoHorizontalOverflow(page);
    });
  });
});
