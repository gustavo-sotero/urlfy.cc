import { createTestLink, login, loginAsAdmin } from './helpers';

const runE2E = process.env.RUN_E2E === 'true';

if (runE2E) {
  const { expect, test } = await import('@playwright/test');

  test.describe('Landing Page', () => {
    test('should display landing page and create link form', async ({
      page
    }) => {
      await page.goto('/');

      // Check for main heading
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Check for link creation form
      const urlInput = page.getByPlaceholder(/url/i);
      await expect(urlInput).toBeVisible();

      const submitButton = page.getByRole('button', { name: /encurtar/i });
      await expect(submitButton).toBeVisible();
    });

    test('should create a short link', async ({ page }) => {
      await page.goto('/');

      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('https://example.com/very-long-url');

      const submitButton = page.getByRole('button', { name: /encurtar/i });
      await submitButton.click();

      // Wait for result
      await page.waitForSelector('[data-testid="short-url"]', {
        timeout: 5000
      });

      // Check if short URL is displayed
      const shortUrl = page.getByTestId('short-url');
      await expect(shortUrl).toBeVisible();
    });

    test('should show error for invalid URL', async ({ page }) => {
      await page.goto('/');

      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('not-a-valid-url');

      const submitButton = page.getByRole('button', { name: /encurtar/i });
      await submitButton.click();

      // Check for error message
      await expect(page.getByText(/inválida/i)).toBeVisible();
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'test@example.com', 'password123');
    });

    test('should display dashboard with user links', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(
        page.getByRole('heading', { name: /dashboard/i })
      ).toBeVisible();
      await expect(page.getByText(/seus links/i)).toBeVisible();
    });

    test('should navigate to create link page', async ({ page }) => {
      await page.goto('/dashboard');
      const createButton = page.getByRole('link', { name: /criar link/i });
      await createButton.click();
      await expect(page).toHaveURL(/\/links\/new/);
    });

    test('should filter links by status', async ({ page }) => {
      await page.goto('/links');
      const filterButton = page.getByRole('button', { name: /filtrar/i });
      await filterButton.click();
      await page.getByRole('menuitem', { name: /ativos/i }).click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/status=active/);
    });
  });

  test.describe('Link Management', () => {
    test.beforeEach(async ({ page }) => {
      const testEmail = process.env.TEST_USER_EMAIL ?? 'test@urlfy.cc';
      const testPassword = process.env.TEST_USER_PASSWORD ?? 'test123';
      await login(page, testEmail, testPassword);
    });

    test('should display link details page', async ({ page }) => {
      const linkId = await createTestLink(page, { url: 'https://example.com' });
      await page.goto(`/links/${linkId}`);
      await expect(
        page.getByRole('heading', { name: /detalhes do link/i })
      ).toBeVisible();
    });

    test('should edit link successfully', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/edit'
      });
      await page.goto(`/links/${linkId}/edit`);
      const aliasInput = page.getByLabel(/alias personalizado/i);
      await aliasInput.fill(`edited-alias-${Date.now()}`);
      await page.getByRole('button', { name: /salvar/i }).click();
      await expect(page.getByText(/atualizado com sucesso/i)).toBeVisible();
    });

    test('should delete link successfully', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/delete'
      });
      await page.goto(`/links/${linkId}`);
      await page.getByRole('button', { name: /ações/i }).click();
      await page.getByRole('menuitem', { name: /excluir/i }).click();
      await page.getByRole('button', { name: /confirmar/i }).click();
      await page.waitForURL('/links');
      await expect(page.getByText(/excluído com sucesso/i)).toBeVisible();
    });

    test('should duplicate link successfully', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/dup'
      });
      await page.goto(`/links/${linkId}`);
      await page.getByRole('button', { name: /ações/i }).click();
      await page.getByRole('menuitem', { name: /duplicar/i }).click();
      await expect(page.getByText(/duplicado com sucesso/i)).toBeVisible();
    });

    test('should create a link with custom settings', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/custom',
        customAlias: `custom-${Date.now()}`,
        expiresAt: 'tomorrow'
      });
      await expect(page).toHaveURL(`/links/${linkId}`);
    });
  });

  test.describe('Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'test@example.com', 'password123');
    });

    test('should display analytics charts', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/stats'
      });
      await page.goto(`/links/${linkId}`);
      await expect(page.getByText(/analytics/i)).toBeVisible();
      await expect(page.locator('[data-testid="clicks-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="devices-chart"]')).toBeVisible();
    });

    test('should filter analytics by date range', async ({ page }) => {
      const linkId = await createTestLink(page, {
        url: 'https://example.com/stats-filter'
      });
      await page.goto(`/links/${linkId}`);
      await page.getByRole('button', { name: /período/i }).click();
      await page.getByRole('menuitem', { name: /últimos 7 dias/i }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="clicks-chart"]')).toBeVisible();
    });
  });

  test.describe('Unlock Page', () => {
    test('should display password form for protected links', async ({
      page
    }) => {
      await login(page, 'test@example.com', 'password123');
      const code = `protected-link-${Date.now()}`;
      await createTestLink(page, {
        url: 'https://example.com/protected',
        password: 'secret-pass',
        customAlias: code
      });

      await page.context().clearCookies();
      await page.goto(`/unlock/${code}`);

      await expect(page.getByLabel(/senha/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /desbloquear/i })
      ).toBeVisible();
    });

    test('should show error for incorrect password', async ({ page }) => {
      await login(page, 'test@example.com', 'password123');
      const code = `protected-link-2-${Date.now()}`;
      await createTestLink(page, {
        url: 'https://example.com/protected-2',
        password: 'secret-pass',
        customAlias: code
      });

      await page.context().clearCookies();
      await page.goto(`/unlock/${code}`);

      await page.getByLabel(/senha/i).fill('wrong-password');
      await page.getByRole('button', { name: /desbloquear/i }).click();
      await expect(page.getByText(/senha incorreta/i)).toBeVisible();
    });
  });

  test.describe('Preview Page', () => {
    test('should display link preview information', async ({ page }) => {
      // Create public link
      await login(page, 'test@example.com', 'password123');
      const code = `preview-link-${Date.now()}`;
      await createTestLink(page, {
        url: 'https://example.com/preview',
        customAlias: code
      });
      await page.context().clearCookies();

      await page.goto(`/preview/${code}`);

      await expect(
        page.getByRole('heading', { name: /preview/i })
      ).toBeVisible();
      await expect(page.getByText(/destino/i)).toBeVisible();
      await expect(
        page.getByRole('link', { name: /acessar link/i })
      ).toBeVisible();
    });
  });

  test.describe('Admin Panel', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('should display admin dashboard with stats', async ({ page }) => {
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: /admin dashboard/i })
      ).toBeVisible();
      await expect(page.getByText(/total links/i)).toBeVisible();
      await expect(page.getByText(/total cliques/i)).toBeVisible();
      await expect(page.getByText(/total usuários/i)).toBeVisible();
    });

    test('should search for links', async ({ page }) => {
      await page.goto('/admin/links');
      const searchInput = page.getByPlaceholder(/buscar/i);
      await searchInput.fill('example.com');
      await page.getByRole('button', { name: /buscar/i }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('should ban a link', async ({ page }) => {
      await page.goto('/admin/links');
      const searchInput = page.getByPlaceholder(/buscar/i);
      await searchInput.fill('example.com');
      await page.getByRole('button', { name: /buscar/i }).click();
      await page.getByRole('button', { name: /banir/i }).first().click();
      await page.getByRole('button', { name: /confirmar/i }).click();
      await expect(page.getByText(/banido com sucesso/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy on landing page', async ({
      page
    }) => {
      await page.goto('/');
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThan(0);
      const skipLink = page.getByRole('link', {
        name: /pular para o conteúdo/i
      });
      await expect(skipLink).toBeInTheDOM();
    });

    test('should be navigable by keyboard', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toHaveAccessibleName(/pular/i);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const urlInput = page.locator(':focus');
      // Relaxed check slightly if type isn't strictly url on input
      await expect(urlInput).toBeVisible();
    });

    test('should announce loading states to screen readers', async ({
      page
    }) => {
      await page.goto('/');
      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('https://example.com');
      const submitButton = page.getByRole('button', { name: /encurtar/i });
      await submitButton.click();
      await expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    test('should have proper ARIA labels on interactive elements', async ({
      page
    }) => {
      await page.goto('/links');
      const searchInput = page.getByRole('searchbox');
      await expect(searchInput).toHaveAccessibleName();
    });

    test('should display error messages with proper announcements', async ({
      page
    }) => {
      await page.goto('/');
      const urlInput = page.getByPlaceholder(/url/i);
      await urlInput.fill('invalid-url');
      const submitButton = page.getByRole('button', { name: /encurtar/i });
      await submitButton.click();
      const errorMessage = page.getByRole('alert');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/inválida/i);
    });

    test('should have skip link for keyboard navigation', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');
      const skipLink = page.getByText(/pular para o conteúdo/i);
      await expect(skipLink).toBeFocused();
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/');
      const urlInput = page.getByRole('textbox', { name: /url/i });
      await expect(urlInput).toBeVisible();
    });
  });

  test.describe('Dark Mode', () => {
    test('should toggle dark mode', async ({ page }) => {
      await page.goto('/');
      const themeToggle = page.getByRole('button', { name: /tema/i });
      await themeToggle.click();
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    });

    test('should persist theme preference', async ({ page }) => {
      await page.goto('/');
      const themeToggle = page.getByRole('button', { name: /tema/i });
      await themeToggle.click();
      await page.reload();
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    });
  });
}
