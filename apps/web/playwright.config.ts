import { defineConfig, devices } from '@playwright/test';

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
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
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

  // Automatically launch the Next.js dev server when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
