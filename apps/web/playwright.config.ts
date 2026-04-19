import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const disableManagedWebServer =
  process.env.PLAYWRIGHT_DISABLE_WEBSERVER === '1' ||
  process.env.PLAYWRIGHT_DISABLE_WEBSERVER === 'true';

function isLocalBaseUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

const shouldManageWebServer =
  !disableManagedWebServer &&
  (!process.env.E2E_BASE_URL || isLocalBaseUrl(baseURL));

const shouldReuseExistingServer =
  Boolean(process.env.E2E_BASE_URL) || !process.env.CI;

/**
 * Playwright configuration for web app E2E tests.
 * Tests run against a locally running Next.js server.
 *
 * Start the server before running: bun run dev
 * Or use the webServer option to launch it automatically.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    // Desktop smoke
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    // Mobile smoke — Pixel 5 (360×800, touch, mobile UA)
    {
      name: 'mobile-pixel5',
      use: { ...devices['Pixel 5'] }
    },
    // Mobile smoke — iPhone 12 (390×844, touch, Safari UA)
    {
      name: 'mobile-iphone12',
      use: { ...devices['iPhone 12'] }
    }
  ],

  // Manage local servers automatically, including CI runs that target localhost.
  // Remote preview/staging URLs remain externally managed.
  webServer: shouldManageWebServer
    ? {
        command: 'bun run dev',
        url: baseURL,
        reuseExistingServer: shouldReuseExistingServer,
        timeout: 120_000
      }
    : undefined
});
