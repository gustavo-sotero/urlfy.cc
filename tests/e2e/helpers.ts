// tests/e2e/helpers.ts
/**
 * E2E Test Helpers for Playwright
 */

import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);

  await page.getByRole('button', { name: /entrar/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  // Use admin credentials from environment
  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'admin@urlfy.cc';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? 'admin123';

  await login(page, adminEmail, adminPassword);
}

export async function logout(page: Page): Promise<void> {
  // Navigate to dashboard to ensure we're logged in
  await page.goto('/dashboard');

  // Open user menu
  await page.getByRole('button', { name: /perfil/i }).click();

  // Click logout
  await page.getByRole('menuitem', { name: /sair/i }).click();

  // Wait for redirect to home
  await page.waitForURL('/', { timeout: 5000 });
}

// ═══════════════════════════════════════════════════════════════════
// LINK HELPERS
// ═══════════════════════════════════════════════════════════════════

export interface CreateLinkOptions {
  url: string;
  customAlias?: string;
  expiresAt?: string;
  maxClicks?: number;
  password?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export async function createTestLink(
  page: Page,
  options: CreateLinkOptions
): Promise<string> {
  await page.goto('/links/new');

  // Fill required URL
  await page.getByLabel(/url de destino/i).fill(options.url);

  // Fill optional fields
  if (options.customAlias) {
    await page.getByLabel(/alias personalizado/i).fill(options.customAlias);
  }

  if (options.password) {
    await page.getByLabel(/senha/i).fill(options.password);
  }

  if (options.metaTitle) {
    await page.getByLabel(/título/i).fill(options.metaTitle);
  }

  if (options.metaDescription) {
    await page.getByLabel(/descrição/i).fill(options.metaDescription);
  }

  if (options.expiresAt) {
    // Open date picker
    const dateButton = page.getByRole('button', {
      name: /selecione uma data/i
    });
    if (await dateButton.isVisible()) {
      await dateButton.click();
      // Select a future date (e.g., next available day matching the input or just a fixed one for testing)
      // For simplicity in this generic helper, we pick the first available enabled day in the calendar
      await page.getByRole('gridcell', { disabled: false }).last().click();
      // Close popover if needed (usually auto-closes)
    }
  }

  if (options.maxClicks) {
    await page.getByLabel(/limite de cliques/i).fill(String(options.maxClicks));
  }

  // Submit form
  await page.getByRole('button', { name: /criar link/i }).click();

  // Wait for redirect to link details
  await page.waitForURL(/\/links\/.+/, { timeout: 5000 });

  // Extract link ID from URL
  const url = page.url();
  const linkId = url.split('/links/')[1]?.split('/')[0] ?? '';

  return linkId;
}

export async function deleteTestLink(
  page: Page,
  linkId: string
): Promise<void> {
  await page.goto(`/links/${linkId}`);

  // Open actions menu
  await page.getByRole('button', { name: /ações/i }).click();

  // Click delete
  await page.getByRole('menuitem', { name: /excluir/i }).click();

  // Confirm deletion
  await page
    .getByRole('button', { name: /confirmar/i })
    .click({ timeout: 5000 });

  // Wait for redirect
  await page.waitForURL('/links', { timeout: 5000 });
}

// ═══════════════════════════════════════════════════════════════════
// WAIT HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function waitForToast(
  page: Page,
  text: string | RegExp
): Promise<void> {
  await page.waitForSelector('[data-testid="toast"]', { timeout: 5000 });

  const toast = page.getByTestId('toast');
  await toast.getByText(text).waitFor({ state: 'visible', timeout: 3000 });
}

export async function waitForLoadingToComplete(page: Page): Promise<void> {
  // Wait for all loading indicators to disappear
  await page.waitForSelector('[aria-busy="true"]', {
    state: 'hidden',
    timeout: 10000
  });
}

// ═══════════════════════════════════════════════════════════════════
// FORM HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function fillFormField(
  page: Page,
  label: string | RegExp,
  value: string
): Promise<void> {
  const input = page.getByLabel(label);
  await input.clear();
  await input.fill(value);
}

export async function selectDateInCalendar(
  page: Page,
  date: Date
): Promise<void> {
  // Open calendar picker
  await page.getByRole('button', { name: /selecionar data/i }).click();

  // Navigate to month/year if needed
  // TODO: Implement month/year navigation

  // Select day
  const day = date.getDate();
  await page.getByRole('button', { name: String(day) }).click();
}

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function checkSkipLink(page: Page): Promise<void> {
  // Tab to focus skip link
  await page.keyboard.press('Tab');

  const skipLink = page.getByText(/pular para o conteúdo/i);
  await skipLink.waitFor({ state: 'visible' });
}

export async function navigateWithKeyboard(
  page: Page,
  times: number = 1
): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Tab');
  }
}

export async function checkAriaLabel(
  page: Page,
  selector: string,
  expectedLabel: string | RegExp
): Promise<boolean> {
  const element = page.locator(selector);
  const ariaLabel = await element.getAttribute('aria-label');

  if (!ariaLabel) return false;

  if (typeof expectedLabel === 'string') {
    return ariaLabel === expectedLabel;
  }

  return expectedLabel.test(ariaLabel);
}

// ═══════════════════════════════════════════════════════════════════
// DATA CLEANUP HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function cleanupTestData(page: Page): Promise<void> {
  // Delete all test links created during the test
  // This should be called in afterEach or afterAll hooks

  await page.goto('/links');

  // Find all links with test prefix
  const testLinks = page.locator('[data-testid^="link-card-test-"]');

  const count = await testLinks.count();

  for (let i = 0; i < count; i++) {
    const link = testLinks.nth(i);
    await link.getByRole('button', { name: /ações/i }).click();
    await page.getByRole('menuitem', { name: /excluir/i }).click();
    await page.getByRole('button', { name: /confirmar/i }).click();
    await page.waitForTimeout(500); // Wait for deletion to complete
  }
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA HELPERS
// ═══════════════════════════════════════════════════════════════════

export function generateTestUrl(index: number = 0): string {
  return `https://example.com/test-url-${Date.now()}-${index}`;
}

export function generateTestAlias(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
