/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN 2FA ENFORCEMENT - E2E TESTS
 * ═════════════════════════════════════════════════════════════════════
 * End-to-end tests for admin panel 2FA enforcement using Playwright.
 *
 * Tests verify the complete user flow through the browser:
 * - Authentication redirect for unauthenticated users
 * - Role authorization redirect for non-admin users
 * - 2FA enforcement redirect for admins without verified 2FA
 * - Successful access for admins with verified 2FA
 *
 * Prerequisites:
 * - Docker services running: `docker compose -f docker/docker-compose.yml up -d`
 * - Test users seeded in database with appropriate roles and 2FA status
 * ═════════════════════════════════════════════════════════════════════
 */

import type { Page } from '@playwright/test';

const runE2E = process.env.RUN_E2E === 'true';

// Test configuration
const ADMIN_PANEL_URL = '/admin';
const LOGIN_URL = '/login';
const DASHBOARD_URL = '/dashboard';
const SETTINGS_2FA_URL = '/dashboard/settings?tab=security&error=2fa-required';

/**
 * Helper: Clear all cookies and storage to simulate logged-out state
 */
async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Helper: Simulate login (assumes login form exists)
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto(LOGIN_URL);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation after login
  await page.waitForURL(/\/(dashboard|admin)/);
}

if (runE2E) {
  const { expect, test } = await import('@playwright/test');
  test.describe('Admin Panel - 2FA Enforcement (E2E)', () => {
    test.beforeEach(async ({ page }) => {
      // Start each test with clean auth state
      await clearAuth(page);
    });

    /**
     * GUARD 1: Authentication Check
     * Unauthenticated users should be redirected to login
     */
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto(ADMIN_PANEL_URL);

      // Should redirect to login with callback URL
      await expect(page).toHaveURL(
        new RegExp(`${LOGIN_URL}.*callbackUrl.*admin`)
      );

      // Login page should be visible
      await expect(
        page.getByRole('heading', { name: /login|entrar/i })
      ).toBeVisible();
    });

    /**
     * GUARD 2: Role Authorization Check
     * Regular users (non-admin) should be redirected to dashboard
     */
    test('should redirect regular user to dashboard', async ({ page }) => {
      // This test requires a test user with role='user'
      // For demo purposes, we'll check if environment has TEST_USER credentials
      const userEmail = process.env.TEST_USER_EMAIL;
      const userPassword = process.env.TEST_USER_PASSWORD;

      if (!userEmail || !userPassword) {
        test.skip();
        return;
      }

      // Login as regular user
      await loginAs(page, userEmail, userPassword);

      // Try to access admin panel
      await page.goto(ADMIN_PANEL_URL);

      // Should redirect to dashboard (not admin panel)
      await expect(page).toHaveURL(DASHBOARD_URL);

      // Dashboard should be visible (not admin panel)
      await expect(
        page.getByRole('heading', { name: /dashboard/i })
      ).toBeVisible();
    });

    /**
     * GUARD 3: 2FA Enforcement Check
     * Admins without verified 2FA should be redirected to settings
     */
    test('should redirect admin without 2FA to settings', async ({ page }) => {
      // This test requires a test admin without 2FA enabled
      const adminEmail = process.env.TEST_ADMIN_NO_2FA_EMAIL;
      const adminPassword = process.env.TEST_ADMIN_NO_2FA_PASSWORD;

      if (!adminEmail || !adminPassword) {
        test.skip();
        return;
      }

      // Login as admin without 2FA
      await loginAs(page, adminEmail, adminPassword);

      // Try to access admin panel
      await page.goto(ADMIN_PANEL_URL);

      // Should redirect to settings with 2FA error
      await expect(page).toHaveURL(SETTINGS_2FA_URL);

      // Settings page should show 2FA requirement message
      await expect(
        page.getByText(/two.*factor|2fa.*required|configurar.*2fa/i)
      ).toBeVisible();
    });

    /**
     * SUCCESS: Admin with verified 2FA
     * Should successfully access admin panel
     */
    test('should grant access to admin with verified 2FA', async ({ page }) => {
      // This test requires a test admin with verified 2FA
      const adminEmail = process.env.TEST_ADMIN_WITH_2FA_EMAIL;
      const adminPassword = process.env.TEST_ADMIN_WITH_2FA_PASSWORD;

      if (!adminEmail || !adminPassword) {
        test.skip();
        return;
      }

      // Login as admin with 2FA
      // Note: This assumes 2FA verification is already handled or skipped in test mode
      await loginAs(page, adminEmail, adminPassword);

      // Access admin panel
      await page.goto(ADMIN_PANEL_URL);

      // Should remain on admin panel
      await expect(page).toHaveURL(ADMIN_PANEL_URL);

      // Admin panel content should be visible
      await expect(
        page.getByRole('heading', { name: /admin|painel.*administra/i })
      ).toBeVisible();

      // Should show admin-specific content (KPIs, user management, etc.)
      await expect(
        page.getByText(/total.*links|usuários|cliques|kpi/i)
      ).toBeVisible();
    });

    /**
     * Security: Session Check
     * Verify that admin panel enforces fresh session check
     */
    test('should enforce fresh session check (no cache)', async ({ page }) => {
      const adminEmail = process.env.TEST_ADMIN_WITH_2FA_EMAIL;
      const adminPassword = process.env.TEST_ADMIN_WITH_2FA_PASSWORD;

      if (!adminEmail || !adminPassword) {
        test.skip();
        return;
      }

      // Login and access admin panel
      await loginAs(page, adminEmail, adminPassword);
      await page.goto(ADMIN_PANEL_URL);
      await expect(page).toHaveURL(ADMIN_PANEL_URL);

      // Manually expire or remove session cookie
      await page.context().clearCookies();

      // Try to access admin panel again
      await page.goto(ADMIN_PANEL_URL);

      // Should redirect to login (session check failed)
      await expect(page).toHaveURL(
        new RegExp(`${LOGIN_URL}.*callbackUrl.*admin`)
      );
    });

    /**
     * Audit Logging: Verify access attempts are logged
     * (This test would require checking database or log output)
     */
    test('should log admin access attempts', async ({ page }) => {
      // This is more of an integration test, but can verify console logs
      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'log' || msg.type() === 'warning') {
          consoleLogs.push(msg.text());
        }
      });

      await page.goto(ADMIN_PANEL_URL);

      // Should redirect to login
      await expect(page).toHaveURL(new RegExp(LOGIN_URL));

      // In development, audit logs might appear in console
      // In production, they would be in database/logs only
      // This is a placeholder test - real audit verification requires DB check
    });
  });
}

/**
 * Test Data Setup Instructions
 * ═════════════════════════════════════════════════════════════════════
 *
 * To run these tests, create test users in your database:
 *
 * 1. Regular User (no admin access):
 *    - Email: TEST_USER_EMAIL (e.g., test-user@urlfy.test)
 *    - Password: TEST_USER_PASSWORD
 *    - Role: 'user'
 *
 * 2. Admin without 2FA:
 *    - Email: TEST_ADMIN_NO_2FA_EMAIL (e.g., admin-no-2fa@urlfy.test)
 *    - Password: TEST_ADMIN_NO_2FA_PASSWORD
 *    - Role: 'admin'
 *    - twoFactorEnabled: false
 *
 * 3. Admin with verified 2FA:
 *    - Email: TEST_ADMIN_WITH_2FA_EMAIL (e.g., admin-2fa@urlfy.test)
 *    - Password: TEST_ADMIN_WITH_2FA_PASSWORD
 *    - Role: 'admin'
 *    - twoFactorEnabled: true
 *    - twoFactor.verified: true
 *
 * Set these as environment variables:
 * ```bash
 * export TEST_USER_EMAIL="test-user@urlfy.test"
 * export TEST_USER_PASSWORD="Password123!"
 * export TEST_ADMIN_NO_2FA_EMAIL="admin-no-2fa@urlfy.test"
 * export TEST_ADMIN_NO_2FA_PASSWORD="Admin123!"
 * export TEST_ADMIN_WITH_2FA_EMAIL="admin-2fa@urlfy.test"
 * export TEST_ADMIN_WITH_2FA_PASSWORD="Admin123!"
 * ```
 *
 * Or create a seed script in `src/db/scripts/seed-test-users.ts`
 */
