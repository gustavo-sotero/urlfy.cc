/**
 * ═════════════════════════════════════════════════════════════════════
 * ERROR PAGES UNIT TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for 404 (Not Found) and Error Boundary pages.
 * Covers both the root-level global fallback files and the localized
 * error surfaces inside the [locale] segment.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function resolveWebPath(relativePath: string): string {
  return resolve(import.meta.dir, '../..', relativePath);
}

function sourceFile(relativePath: string) {
  return Bun.file(resolveWebPath(relativePath));
}

function readSourceFile(relativePath: string): Promise<string> {
  return readFile(resolveWebPath(relativePath), 'utf-8');
}

// ─── Root Fallback Files ─────────────────────────────────────────────────────

describe('Root Fallback Error Files Existence', () => {
  it('should have not-found.tsx file in app directory', () => {
    const file = sourceFile('src/app/not-found.tsx');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have error.tsx file in app directory', () => {
    const file = sourceFile('src/app/error.tsx');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have global-error.tsx file in app directory', () => {
    const file = sourceFile('src/app/global-error.tsx');
    expect(file.size).toBeGreaterThan(0);
  });
});

describe('Root Error Page Structure', () => {
  it('not-found.tsx should export metadata and default component', async () => {
    const content = await readSourceFile('src/app/not-found.tsx');

    expect(content).toContain('export const metadata');
    expect(content).toContain('export default function');
    expect(content).toContain('FileQuestion');
  });

  it('error.tsx should be a client component with error handling', async () => {
    const content = await readSourceFile('src/app/error.tsx');

    expect(content).toContain("'use client'");
    expect(content).toContain('export default function');
    expect(content).toContain('error: Error');
    expect(content).toContain('reset: () => void');
    expect(content).toContain('AlertTriangle');
  });

  it('help page should have FAQ accordion structure', async () => {
    const content = await readSourceFile(
      'src/app/[locale]/(public)/help/page.tsx'
    );

    expect(content).toContain('Accordion');
    expect(content).toContain('AccordionItem');
    expect(content).toContain('AccordionTrigger');
    expect(content).toContain('AccordionContent');
    expect(content).toContain("t('faqTitle')");
  });
});

describe('Root Error Page Components', () => {
  it('not-found page should have proper Next.js metadata', async () => {
    const content = await readSourceFile('src/app/not-found.tsx');

    expect(content).toMatch(/title:\s*['"](Page not found|.*404.*)/);
    expect(content).toContain('robots:');
    expect(content).toContain('index: false');
  });

  it('error page should use useEffect for logging', async () => {
    const content = await readSourceFile('src/app/error.tsx');

    expect(content).toContain('useEffect');
    expect(content).toContain('reportBrowserError');
    expect(content).toContain('digest');
  });

  it('error page should display development details', async () => {
    const content = await readSourceFile('src/app/error.tsx');

    expect(content).toContain('NODE_ENV');
    expect(content).toContain('development');
    expect(content).toContain('details'); // JSX element
    expect(content).toContain('error.stack');
  });
});

describe('Root Error Page UI Elements', () => {
  it('not-found page should have navigation buttons', async () => {
    const content = await readSourceFile('src/app/not-found.tsx');

    expect(content).toContain('<Button');
    expect(content).toContain('href="/"');
  });

  it('error page should have retry and home buttons', async () => {
    const content = await readSourceFile('src/app/error.tsx');

    expect(content).toContain('onClick={reset}');
    expect(content).toContain('href="/"');
  });

  it('both root pages should use consistent flex centering', async () => {
    const notFoundContent = await readSourceFile('src/app/not-found.tsx');
    const errorContent = await readSourceFile('src/app/error.tsx');

    expect(notFoundContent).toContain('flex');
    expect(notFoundContent).toContain('items-center');
    expect(notFoundContent).toContain('justify-center');

    expect(errorContent).toContain('flex');
    expect(errorContent).toContain('items-center');
    expect(errorContent).toContain('justify-center');
  });
});

// ─── Localized Error Files ────────────────────────────────────────────────────

describe('Localized Error Files Existence', () => {
  it('should have localized not-found.tsx inside [locale] segment', () => {
    const file = sourceFile('src/app/[locale]/not-found.tsx');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have localized error.tsx inside [locale] segment', () => {
    const file = sourceFile('src/app/[locale]/error.tsx');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have catch-all route inside [locale] segment', () => {
    const file = sourceFile('src/app/[locale]/[...rest]/page.tsx');
    expect(file.size).toBeGreaterThan(0);
  });
});

describe('Localized Not-Found Page', () => {
  it('should use getTranslations for locale-driven content', async () => {
    const content = await readSourceFile('src/app/[locale]/not-found.tsx');

    expect(content).toContain('getTranslations');
    expect(content).toContain('Errors.notFound');
  });

  it('should use i18n-aware Link for navigation', async () => {
    const content = await readSourceFile('src/app/[locale]/not-found.tsx');

    expect(content).toContain("from '@/i18n/routing'");
    expect(content).toContain('<Link');
  });

  it('should render translated back-home and help-center buttons', async () => {
    const content = await readSourceFile('src/app/[locale]/not-found.tsx');

    expect(content).toContain("t('backHome')");
    expect(content).toContain("t('helpCenter')");
  });

  it('should not be a client component', async () => {
    const content = await readSourceFile('src/app/[locale]/not-found.tsx');

    expect(content).not.toContain("'use client'");
  });
});

describe('Localized Error Boundary', () => {
  it('should be a client component', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain("'use client'");
  });

  it('should use useTranslations for locale-driven content', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain('useTranslations');
    expect(content).toContain('Errors.serverError');
  });

  it('should report errors via reportBrowserError', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain('useEffect');
    expect(content).toContain('reportBrowserError');
    expect(content).toContain('digest');
  });

  it('should render translated retry and back-home buttons', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain("t('retry')");
    expect(content).toContain("t('backHome')");
  });

  it('should use i18n-aware Link for navigation', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain("from '@/i18n/routing'");
    expect(content).toContain('<Link');
  });

  it('should show development details block', async () => {
    const content = await readSourceFile('src/app/[locale]/error.tsx');

    expect(content).toContain('NODE_ENV');
    expect(content).toContain('development');
    expect(content).toContain('error.stack');
  });
});

describe('Localized Catch-All Route', () => {
  it('should call notFound() to produce a localized 404', async () => {
    const content = await readSourceFile('src/app/[locale]/[...rest]/page.tsx');

    expect(content).toContain('notFound');
    expect(content).toContain("from 'next/navigation'");
  });

  it('should not contain any UI markup', async () => {
    const content = await readSourceFile('src/app/[locale]/[...rest]/page.tsx');

    expect(content).not.toContain('<div');
    expect(content).not.toContain('return (');
  });
});
