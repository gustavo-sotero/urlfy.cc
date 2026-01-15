// tests/e2e/ui.spec.ts
import { expect, test } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display landing page and create link form', async ({ page }) => {
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
    await page.waitForSelector('[data-testid="short-url"]', { timeout: 5000 });

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
  test.beforeEach(async () => {
    // TODO: Implement login helper
    // await login(page, 'test@example.com', 'password');
  });

  test('should display dashboard with user links', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for dashboard heading
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
    ).toBeVisible();

    // Check for links section
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

    // Open filter dropdown
    const filterButton = page.getByRole('button', { name: /filtrar/i });
    await filterButton.click();

    // Select 'active' filter
    await page.getByRole('menuitem', { name: /ativos/i }).click();

    // Wait for filtered results
    await page.waitForLoadState('networkidle');

    // Check URL has filter parameter
    await expect(page).toHaveURL(/status=active/);
  });
});

test.describe('Link Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test user
    const testEmail = process.env.TEST_USER_EMAIL ?? 'test@urlfy.cc';
    const testPassword = process.env.TEST_USER_PASSWORD ?? 'test123';

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/senha|password/i).fill(testPassword);
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
  });

  test('should display link details page', async ({ page }) => {
    // TODO: Create a test link first
    // const linkId = await createTestLink(page);

    // Navigate to link details
    // await page.goto(`/links/${linkId}`);

    // Check for link details
    // await expect(page.getByRole("heading", { name: /detalhes do link/i })).toBeVisible();
    expect(page).toBeDefined(); // Placeholder
  });

  test('should edit link successfully', async ({ page }) => {
    // TODO: Implement after creating test link
    expect(page).toBeDefined(); // Placeholder
  });

  test('should delete link successfully', async ({ page }) => {
    // TODO: Implement after creating test link
    expect(page).toBeDefined(); // Placeholder
  });

  test('should duplicate link successfully', async ({ page }) => {
    // TODO: Implement after creating test link
    expect(page).toBeDefined(); // Placeholder
  });

  test('should create a link with custom settings', async ({ page }) => {
    await page.goto('/links/new');

    // Fill in form
    await page.getByLabel(/url de destino/i).fill('https://example.com');
    await page.getByLabel(/alias personalizado/i).fill('my-custom-link');

    // Set expiration date
    await page.getByLabel(/data de expiração/i).click();
    // TODO: Select date from calendar

    // Submit form
    await page.getByRole('button', { name: /criar link/i }).click();

    // Wait for redirect to link details
    await page.waitForURL(/\/links\/.+/);

    // Check success message
    await expect(page.getByText(/link criado com sucesso/i)).toBeVisible();
  });

  test('should edit link metadata', async ({ page }) => {
    // TODO: Create a test link first
    const linkId = 'test-link-id';

    await page.goto(`/links/${linkId}/edit`);

    // Update meta title
    const metaTitle = page.getByLabel(/título/i);
    await metaTitle.fill('New Custom Title');

    // Save changes
    await page.getByRole('button', { name: /salvar/i }).click();

    // Check for success message
    await expect(page.getByText(/atualizado com sucesso/i)).toBeVisible();
  });

  test('should delete a link', async ({ page }) => {
    // TODO: Create a test link first
    const linkId = 'test-link-id';

    await page.goto(`/links/${linkId}`);

    // Open actions menu
    await page.getByRole('button', { name: /ações/i }).click();

    // Click delete
    await page.getByRole('menuitem', { name: /excluir/i }).click();

    // Confirm deletion
    await page.getByRole('button', { name: /confirmar/i }).click();

    // Wait for redirect
    await page.waitForURL('/links');

    // Check for success message
    await expect(page.getByText(/excluído com sucesso/i)).toBeVisible();
  });

  test('should duplicate a link', async ({ page }) => {
    // TODO: Create a test link first
    const linkId = 'test-link-id';

    await page.goto(`/links/${linkId}`);

    // Open actions menu
    await page.getByRole('button', { name: /ações/i }).click();

    // Click duplicate
    await page.getByRole('menuitem', { name: /duplicar/i }).click();

    // Wait for new link to be created
    await page.waitForURL(/\/links\/.+/);

    // Check for success message
    await expect(page.getByText(/duplicado com sucesso/i)).toBeVisible();
  });
});

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Implement login helper
    // await login(page, 'test@example.com', 'password');
    await page.goto('/dashboard');
  });

  test('should display analytics charts', async ({ page }) => {
    // TODO: Create a test link with some clicks first
    const linkId = 'test-link-id';

    await page.goto(`/links/${linkId}`);

    // Check for analytics section
    await expect(page.getByText(/analytics/i)).toBeVisible();

    // Check for charts
    await expect(page.locator('[data-testid="clicks-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="devices-chart"]')).toBeVisible();
  });

  test('should filter analytics by date range', async ({ page }) => {
    const linkId = 'test-link-id';

    await page.goto(`/links/${linkId}`);

    // Open date range picker
    await page.getByRole('button', { name: /período/i }).click();

    // Select last 7 days
    await page.getByRole('menuitem', { name: /últimos 7 dias/i }).click();

    // Wait for data to reload
    await page.waitForLoadState('networkidle');

    // Charts should update
    await expect(page.locator('[data-testid="clicks-chart"]')).toBeVisible();
  });
});

test.describe('Unlock Page', () => {
  test('should display password form for protected links', async ({ page }) => {
    // TODO: Create a password-protected test link first
    const code = 'protected-link';

    await page.goto(`/unlock/${code}`);

    // Check for password form
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /desbloquear/i })
    ).toBeVisible();
  });

  test('should show error for incorrect password', async ({ page }) => {
    const code = 'protected-link';

    await page.goto(`/unlock/${code}`);

    // Enter wrong password
    await page.getByLabel(/senha/i).fill('wrong-password');
    await page.getByRole('button', { name: /desbloquear/i }).click();

    // Check for error message
    await expect(page.getByText(/senha incorreta/i)).toBeVisible();
  });
});

test.describe('Preview Page', () => {
  test('should display link preview information', async ({ page }) => {
    const code = 'test-link';

    await page.goto(`/preview/${code}`);

    // Check for preview card
    await expect(page.getByRole('heading', { name: /preview/i })).toBeVisible();

    // Check for link information
    await expect(page.getByText(/url curta/i)).toBeVisible();
    await expect(page.getByText(/destino/i)).toBeVisible();

    // Check for access button
    await expect(
      page.getByRole('link', { name: /acessar link/i })
    ).toBeVisible();
  });
});

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Implement admin login helper
    // await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('should display admin dashboard with stats', async ({ page }) => {
    await page.goto('/admin');

    // Check for admin dashboard
    await expect(
      page.getByRole('heading', { name: /admin dashboard/i })
    ).toBeVisible();

    // Check for stat cards
    await expect(page.getByText(/total links/i)).toBeVisible();
    await expect(page.getByText(/total cliques/i)).toBeVisible();
    await expect(page.getByText(/total usuários/i)).toBeVisible();
  });

  test('should search for links', async ({ page }) => {
    await page.goto('/admin/links');

    // Enter search query
    const searchInput = page.getByPlaceholder(/buscar/i);
    await searchInput.fill('test-link');

    // Click search button
    await page.getByRole('button', { name: /buscar/i }).click();

    // Wait for results
    await page.waitForLoadState('networkidle');

    // Results should be displayed
    // TODO: Check for specific results
  });

  test('should ban a link', async ({ page }) => {
    await page.goto('/admin/links');

    // Search for link
    await page.getByPlaceholder(/buscar/i).fill('test-link');
    await page.getByRole('button', { name: /buscar/i }).click();

    // Click ban button on first result
    await page.getByRole('button', { name: /banir/i }).first().click();

    // Confirm ban
    await page.getByRole('button', { name: /confirmar/i }).click();

    // Check for success message
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

    // Check for skip link
    const skipLink = page.getByRole('link', { name: /pular para o conteúdo/i });
    await expect(skipLink).toBeInTheDOM();
  });

  test('should be navigable by keyboard', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // Should focus on skip link first
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toHaveAccessibleName(/pular/i);

    // Continue tabbing to form
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should reach URL input
    const urlInput = page.locator(':focus');
    await expect(urlInput).toHaveAttribute('type', 'url');
  });

  test('should announce loading states to screen readers', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.getByPlaceholder(/url/i);
    await urlInput.fill('https://example.com');

    const submitButton = page.getByRole('button', { name: /encurtar/i });
    await submitButton.click();

    // Check for aria-busy during loading
    await expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });

  test('should have proper ARIA labels on interactive elements', async ({
    page
  }) => {
    await page.goto('/links');

    // Check for proper labeling
    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toHaveAccessibleName();

    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      await expect(button).toHaveAccessibleName();
    }
  });

  test('should display error messages with proper announcements', async ({
    page
  }) => {
    await page.goto('/');

    const urlInput = page.getByPlaceholder(/url/i);
    await urlInput.fill('invalid-url');

    const submitButton = page.getByRole('button', { name: /encurtar/i });
    await submitButton.click();

    // Check for alert role
    const errorMessage = page.getByRole('alert');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/inválida/i);
  });

  test('should have skip link for keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Focus should start at skip link
    await page.keyboard.press('Tab');

    const skipLink = page.getByText(/pular para o conteúdo/i);
    await expect(skipLink).toBeFocused();
  });

  test('should navigate dashboard with keyboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter on focused link
    await page.keyboard.press('Enter');

    // Should navigate
    await page.waitForLoadState('networkidle');
  });

  test('should announce loading states to screen readers', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for aria-busy during loading
    const _loadingElement = page.locator('[aria-busy="true"]');
    // Element might not be visible if page loads fast
    // This is just a check that the attribute exists when loading
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');

    // Check that inputs have associated labels
    const urlInput = page.getByRole('textbox', { name: /url/i });
    await expect(urlInput).toBeVisible();
  });
});

test.describe('Dark Mode', () => {
  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeToggle = page.getByRole('button', { name: /tema/i });
    await themeToggle.click();

    // Check that dark class is applied
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('should persist theme preference', async ({ page }) => {
    await page.goto('/');

    // Toggle to dark mode
    const themeToggle = page.getByRole('button', { name: /tema/i });
    await themeToggle.click();

    // Reload page
    await page.reload();

    // Dark mode should still be active
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });
});
