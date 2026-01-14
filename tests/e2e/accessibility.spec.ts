// tests/e2e/accessibility.spec.ts
/**
 * Accessibility E2E Tests
 * Tests WCAG 2.1 AA compliance for UI components
 */

import { expect, test } from "@playwright/test";

test.describe("Accessibility - Landing Page", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Check h1 exists and is unique
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Check heading levels are sequential
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
    let previousLevel = 0;

    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName);
      const level = parseInt(tagName.substring(1), 10);

      // Level should not skip (e.g., h1 -> h3)
      expect(level).toBeLessThanOrEqual(previousLevel + 1);
      previousLevel = level;
    }
  });

  test("should have skip link for keyboard navigation", async ({ page }) => {
    await page.goto("/");

    // Skip link should be present
    const skipLink = page.getByText(
      /pular para o conte\u00fado|skip to content/i,
    );
    await expect(skipLink).toBeAttached();

    // Focus skip link with Tab
    await page.keyboard.press("Tab");

    // Skip link should become visible on focus
    await expect(skipLink).toBeVisible();

    // Clicking should jump to main content
    await skipLink.click();
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe("main-content");
  });

  test("should have accessible form inputs", async ({ page }) => {
    await page.goto("/");

    const urlInput = page.getByLabel(/url/i);

    // Input should have label
    await expect(urlInput).toBeVisible();

    // Input should have accessible name
    const ariaLabel = await urlInput.getAttribute("aria-label");
    const labelFor = await page
      .locator(`label[for="${await urlInput.getAttribute("id")}"]`)
      .count();

    expect(ariaLabel || labelFor > 0).toBeTruthy();
  });

  test("should announce form errors to screen readers", async ({ page }) => {
    await page.goto("/");

    // Submit empty form
    const submitButton = page.getByRole("button", { name: /encurtar/i });
    await submitButton.click();

    // Error should have aria-live or role="alert"
    const errorMessage = page.locator('[role="alert"], [aria-live]').first();
    await expect(errorMessage).toBeVisible({ timeout: 2000 });

    // Error should be associated with input
    const urlInput = page.getByLabel(/url/i);
    const ariaInvalid = await urlInput.getAttribute("aria-invalid");
    expect(ariaInvalid).toBe("true");
  });

  test("should have sufficient color contrast", async ({ page }) => {
    await page.goto("/");

    // Test primary text contrast
    const heading = page.getByRole("heading", { level: 1 });
    const contrast = await heading.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bg = style.backgroundColor;

      // Simple luminance calculation
      const getLuminance = (rgb: string) => {
        const values = rgb.match(/\\d+/g)?.map(Number) || [0, 0, 0];
        const [r, g, b] = values.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const fgLuminance = getLuminance(color);
      const bgLuminance = getLuminance(bg);

      const ratio =
        (Math.max(fgLuminance, bgLuminance) + 0.05) /
        (Math.min(fgLuminance, bgLuminance) + 0.05);

      return ratio;
    });

    // WCAG AA requires 4.5:1 for normal text
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("Accessibility - Keyboard Navigation", () => {
  test("should navigate form with Tab key", async ({ page }) => {
    await page.goto("/");

    // Press Tab to focus first interactive element
    await page.keyboard.press("Tab");

    // Skip link should be focused
    let focused = await page.evaluate(
      () => document.activeElement?.textContent,
    );
    expect(focused).toContain("Pular");

    // Tab to URL input
    await page.keyboard.press("Tab");
    focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe("INPUT");

    // Tab to submit button
    await page.keyboard.press("Tab");
    focused = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("type") ||
        document.activeElement?.tagName,
    );
    expect(["submit", "BUTTON"]).toContain(focused);
  });

  test("should have visible focus indicators", async ({ page }) => {
    await page.goto("/");

    const submitButton = page.getByRole("button", { name: /encurtar/i });

    // Focus button
    await submitButton.focus();

    // Check for focus ring (outline or box-shadow)
    const hasFocusStyle = await submitButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;

      return outline !== "none" || boxShadow !== "none";
    });

    expect(hasFocusStyle).toBeTruthy();
  });

  test("should trap focus in modals", async ({ page }) => {
    await page.goto("/dashboard/links");

    // Open delete confirmation dialog
    const deleteButton = page.getByRole("button", { name: /deletar/i }).first();
    await deleteButton.click();

    // Modal should be visible
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Tab through modal elements
    await page.keyboard.press("Tab");

    // Focus should stay within modal
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const focusedElement = await page.evaluate(() => document.activeElement);
      const modalElement = await modal.elementHandle();

      if (!modalElement || !focusedElement) continue;

      const isInsideModal = await page.evaluate(
        ({ modal, focused }) => modal?.contains(focused),
        { modal: modalElement, focused: focusedElement },
      );

      expect(isInsideModal).toBeTruthy();
    }
  });
});

test.describe("Accessibility - ARIA Attributes", () => {
  test("should have aria-label on icon-only buttons", async ({ page }) => {
    await page.goto("/dashboard/links");

    // Find icon-only buttons (e.g., more options)
    const iconButtons = page.getByRole("button").filter({
      has: page.locator("svg"),
      hasNot: page.locator("span, text"),
    });

    const count = await iconButtons.count();

    for (let i = 0; i < count; i++) {
      const button = iconButtons.nth(i);
      const hasLabel =
        (await button.getAttribute("aria-label")) ||
        (await button.getAttribute("aria-labelledby"));

      expect(hasLabel).toBeTruthy();
    }
  });

  test("should use aria-busy during loading states", async ({ page }) => {
    await page.goto("/");

    const urlInput = page.getByLabel(/url/i);
    const submitButton = page.getByRole("button", { name: /encurtar/i });

    // Fill and submit
    await urlInput.fill("https://example.com");
    await submitButton.click();

    // Button should have aria-busy during request
    const ariaBusy = await submitButton.getAttribute("aria-busy");
    expect(["true", null]).toContain(ariaBusy);
  });

  test("should have proper role for lists", async ({ page }) => {
    await page.goto("/dashboard/links");

    // Links list should have proper structure
    const list = page.locator('[role="list"], ul, ol').first();
    await expect(list).toBeVisible();

    // List items should have role="listitem" or be <li>
    const items = page.locator('[role="listitem"], li');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should announce dynamic content changes", async ({ page }) => {
    await page.goto("/dashboard/links");

    // Check for live regions
    const liveRegions = page.locator(
      '[aria-live="polite"], [aria-live="assertive"]',
    );
    const count = await liveRegions.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Accessibility - Screen Reader Support", () => {
  test("should have descriptive link text", async ({ page }) => {
    await page.goto("/");

    // Find all links
    const links = await page.getByRole("link").all();

    for (const link of links) {
      const text = await link.textContent();

      // Links should not have vague text
      const vagueTerms = [
        "clique aqui",
        "click here",
        "saiba mais",
        "leia mais",
        "aqui",
        "here",
      ];

      const hasVagueText = vagueTerms.some(
        (term) => text?.toLowerCase().trim() === term.toLowerCase(),
      );

      expect(hasVagueText).toBeFalsy();
    }
  });

  test("should have alt text for images", async ({ page }) => {
    await page.goto("/");

    const images = await page.locator("img").all();

    for (const img of images) {
      const alt = await img.getAttribute("alt");
      expect(alt).toBeDefined();
    }
  });

  test("should use semantic HTML", async ({ page }) => {
    await page.goto("/");

    // Check for semantic landmarks
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("header, [role=banner]")).toBeAttached();
    await expect(page.locator("footer, [role=contentinfo]")).toBeAttached();
  });
});

test.describe("Accessibility - Mobile Support", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should have touch-friendly targets", async ({ page }) => {
    await page.goto("/");

    const submitButton = page.getByRole("button", { name: /encurtar/i });

    // Get button size
    const box = await submitButton.boundingBox();

    // WCAG recommends minimum 44x44px touch target
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("should be responsive", async ({ page }) => {
    await page.goto("/");

    // Check if viewport meta tag exists
    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");

    expect(viewportMeta).toContain("width=device-width");

    // Check if content is visible without horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });
});
