import { expect, type Page, test } from '@playwright/test';

const ANONYMOUS_SESSION = {
  session: null,
  user: null
} as const;

const SESSION_ENDPOINT = '/api/auth/get-session';

const ACCEPTED_CONSENT = {
  analytics: true,
  marketing: true,
  timestamp: '2026-04-18T00:00:00.000Z'
} as const;

const CREATED_LINK_RESPONSE = {
  id: 'link-1',
  shortCode: 'demo123',
  shortUrl: 'https://urlfy.cc/demo123',
  originalUrl: 'https://example.com/mobile/form-success-state',
  redirectType: 302,
  clicksCount: 0,
  maxClicks: null,
  isActive: true,
  isBanned: false,
  bannedReason: null,
  isProtected: false,
  expiresAt: null,
  metaTitle: null,
  metaDescription: null,
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  tags: null,
  notes: null,
  lastClickedAt: null,
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z'
} as const;

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface VisitHomeOptions {
  showConsentBanner?: boolean;
  locale?: SupportedLocale;
}

function getMobileDrawer(page: Page) {
  return page.locator('[data-slot="sheet-content"][data-state="open"]');
}

function getConsentBanner(page: Page) {
  return page.getByRole('dialog', {
    name: /preferências de privacidade|privacy preferences/i
  });
}

async function visitHome(page: Page, options: VisitHomeOptions = {}) {
  await page.addInitScript(
    ({ storedConsent, shouldShowBanner, sessionData, sessionEndpoint }) => {
      if (shouldShowBanner) {
        localStorage.removeItem('consent_preferences');
      } else {
        localStorage.setItem(
          'consent_preferences',
          JSON.stringify(storedConsent)
        );
      }

      const originalFetch = window.fetch.bind(window);
      const sessionPayload = JSON.stringify(sessionData);

      const getRequestUrl = (input: RequestInfo | URL) => {
        if (typeof input === 'string') {
          return input;
        }

        if (input instanceof URL) {
          return input.toString();
        }

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

      (
        window as Window & {
          __mockSessionRequests?: number;
        }
      ).__mockSessionRequests = 0;

      const mockedFetch = Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          if (matchesSessionEndpoint(getRequestUrl(input))) {
            (
              window as Window & {
                __mockSessionRequests?: number;
              }
            ).__mockSessionRequests =
              ((
                window as Window & {
                  __mockSessionRequests?: number;
                }
              ).__mockSessionRequests ?? 0) + 1;

            return new Response(sessionPayload, {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            });
          }

          return originalFetch(input, init);
        },
        originalFetch
      ) as typeof window.fetch;

      window.fetch = mockedFetch;
    },
    {
      storedConsent: ACCEPTED_CONSENT,
      shouldShowBanner: options.showConsentBanner ?? false,
      sessionData: ANONYMOUS_SESSION,
      sessionEndpoint: SESSION_ENDPOINT
    }
  );

  await page.goto(`/${options.locale ?? 'en'}`, {
    waitUntil: 'domcontentloaded'
  });

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as Window & {
                __mockSessionRequests?: number;
              }
            ).__mockSessionRequests ?? 0
        ),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(0);

  await expect
    .poll(
      () => page.getByRole('button', { name: /loading|carregando/i }).count(),
      { timeout: 10_000 }
    )
    .toBe(0);

  if (options.showConsentBanner) {
    await expect(getConsentBanner(page)).toBeVisible({ timeout: 3_000 });
  }
}

async function mockCreateLink(page: Page) {
  await page.route('**/api/links', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as { url?: string };

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          ...CREATED_LINK_RESPONSE,
          originalUrl: payload.url ?? CREATED_LINK_RESPONSE.originalUrl
        }
      })
    });
  });
}

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
  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name === 'chromium-desktop',
      'Mobile smoke runs only on mobile device projects.'
    );
  });

  // ────────────────────────────────────────────────────────────────
  // Layout integrity
  // ────────────────────────────────────────────────────────────────

  test('home loads without horizontal overflow', async ({ page }) => {
    await visitHome(page);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('hero section and CTA are visible without horizontal scroll', async ({
    page
  }) => {
    await visitHome(page);

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
    await visitHome(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();

    await menuButton.press('Enter');

    // Drawer should be open — nav links should be visible
    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole('button', { name: /language|idioma/i })
    ).toBeVisible();
  });

  test('mobile nav drawer has only one close affordance', async ({ page }) => {
    await visitHome(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.press('Enter');

    const drawer = getMobileDrawer(page);
    await expect(drawer).toBeVisible();

    // Count all close-related buttons — the SheetContent built-in is the only one
    // The navbar must NOT add a second custom close button
    const closeButtons = drawer.getByRole('button', { name: /close|fechar/i });
    const count = await closeButtons.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('closing the drawer preserves background layout integrity', async ({
    page
  }) => {
    await visitHome(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.press('Enter');

    await expect(getMobileDrawer(page)).toBeVisible();

    // Close via the built-in X button (sr-only text "Close")
    await page.keyboard.press('Escape');

    // Dialog should be gone
    await expect(getMobileDrawer(page)).toHaveCount(0);

    // Background still free of horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('drawer items are not touching the edges — have visible padding', async ({
    page
  }) => {
    await visitHome(page);

    const menuButton = page.getByRole('button', { name: 'Menu' });
    await menuButton.press('Enter');

    const dialog = getMobileDrawer(page);
    await expect(dialog).toBeVisible();

    // The logo link inside the drawer should not be at x=0
    const logoLink = dialog.getByRole('link').first();
    const box = await logoLink.boundingBox();
    expect(box).not.toBeNull();
    // Verify there's at least 16px of padding on the left
    expect(box?.x).toBeGreaterThan(16);
  });

  for (const locale of SUPPORTED_LOCALES) {
    test(`critical home flow remains stable for locale ${locale}`, async ({
      page
    }) => {
      await visitHome(page, {
        locale,
        showConsentBanner: true
      });

      const menuButton = page.getByRole('button', { name: 'Menu' });
      await expect(menuButton).toBeVisible();
      await menuButton.press('Enter');
      await expect(getMobileDrawer(page)).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(getMobileDrawer(page)).toHaveCount(0);

      const consentBanner = getConsentBanner(page);
      await expect(consentBanner).toBeVisible();

      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'instant'
        })
      );

      const localeHeading =
        locale === 'pt-br'
          ? /pronto para mais recursos/i
          : /ready for more features/i;

      await expect(
        page.getByRole('heading', { name: localeHeading })
      ).toBeVisible();

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  }

  test.describe('320px edge viewport', () => {
    test.use({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true
    });

    test('home and final CTA remain within the viewport', async ({ page }) => {
      await visitHome(page);

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);

      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'instant'
        })
      );

      await expect(
        page.getByRole('heading', { level: 2 }).last()
      ).toBeVisible();

      const finalBodyWidth = await page.evaluate(
        () => document.body.scrollWidth
      );
      expect(finalBodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });

  test.describe('640px breakpoint guard', () => {
    test.use({
      viewport: { width: 640, height: 960 },
      isMobile: true,
      hasTouch: true
    });

    test('drawer, consent banner, and final CTA stay stable at 640px width', async ({
      page
    }) => {
      await visitHome(page, { showConsentBanner: true, locale: 'pt-br' });

      const initialBodyWidth = await page.evaluate(
        () => document.body.scrollWidth
      );
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(initialBodyWidth).toBeLessThanOrEqual(viewportWidth);

      const menuButton = page.getByRole('button', { name: 'Menu' });
      await expect(menuButton).toBeVisible();
      await menuButton.press('Enter');
      await expect(getMobileDrawer(page)).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(getMobileDrawer(page)).toHaveCount(0);

      const consentBanner = getConsentBanner(page);
      await expect(consentBanner).toBeVisible();
      await expect(
        consentBanner.getByRole('button', { name: /aceitar tudo|accept all/i })
      ).toBeVisible();

      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'instant'
        })
      );

      await expect(
        page.getByRole('heading', { name: /pronto para mais recursos/i })
      ).toBeVisible();

      const finalBodyWidth = await page.evaluate(
        () => document.body.scrollWidth
      );
      expect(finalBodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Consent banner
  // ────────────────────────────────────────────────────────────────

  test('consent banner appears after delay and action buttons are reachable', async ({
    page
  }) => {
    await visitHome(page, { showConsentBanner: true });

    const dialog = getConsentBanner(page);
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
    await visitHome(page, { showConsentBanner: true });

    const dialog = getConsentBanner(page);
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
    await visitHome(page);

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
    );

    const ctaHeading = page.getByRole('heading', {
      name: /ready for more features|pronto para mais recursos/i
    });
    await expect(ctaHeading).toBeVisible();

    const primaryCta = page.getByRole('link', {
      name: /get started for free|começar gratuitamente/i
    });
    const secondaryCta = page.getByRole('link', {
      name: /sign in|fazer login/i
    });

    await expect(primaryCta).toBeVisible();
    await expect(secondaryCta).toBeVisible();

    const primaryBox = await primaryCta.boundingBox();
    const secondaryBox = await secondaryCta.boundingBox();

    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect((secondaryBox?.y ?? 0) - (primaryBox?.y ?? 0)).toBeGreaterThan(8);

    // Verify no horizontal overflow after revealing CTA
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('hero link form success state stays within the mobile viewport', async ({
    page
  }) => {
    await mockCreateLink(page);
    await visitHome(page, { locale: 'pt-br' });

    await page
      .locator('input[type="url"]')
      .first()
      .fill(CREATED_LINK_RESPONSE.originalUrl);
    await page.getByRole('button', { name: /encurtar|shorten/i }).click();

    const shortUrlInput = page.getByTestId('short-url');
    await expect(shortUrlInput).toHaveValue(CREATED_LINK_RESPONSE.shortUrl);

    const copyButton = page.getByRole('button', {
      name: /copy|copied|copiar|copiado/i
    });
    await expect(copyButton).toBeVisible();

    const shortUrlBox = await shortUrlInput.boundingBox();
    const copyButtonBox = await copyButton.boundingBox();

    expect(shortUrlBox).not.toBeNull();
    expect(copyButtonBox).not.toBeNull();
    expect((copyButtonBox?.y ?? 0) - (shortUrlBox?.y ?? 0)).toBeGreaterThan(8);

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

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Desktop regression guard runs only on the desktop Chromium project.'
    );
  });

  test('desktop nav shows links without mobile menu button', async ({
    page
  }) => {
    await visitHome(page);

    // Desktop nav should be visible
    const desktopNav = page.locator('nav').first();
    await expect(desktopNav).toBeVisible();

    // Mobile menu button is hidden at desktop width
    const menuButton = page.getByRole('button', { name: 'Menu' });
    // On desktop, the button is present in DOM but visually hidden via md:hidden
    // Playwright considers visibility based on computed style
    await expect(menuButton).not.toBeVisible();
  });

  test.describe('768px breakpoint guard', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('desktop navigation takes over cleanly at 768px', async ({ page }) => {
      await visitHome(page, { locale: 'pt-br', showConsentBanner: true });

      const menuButton = page.getByRole('button', { name: 'Menu' });
      await expect(menuButton).not.toBeVisible();

      await expect(
        page
          .getByRole('link', { name: /recursos|o projeto|documentação/i })
          .first()
      ).toBeVisible();

      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'instant'
        })
      );

      await expect(
        page.getByRole('heading', { name: /pronto para mais recursos/i })
      ).toBeVisible();

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 0;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });
});
