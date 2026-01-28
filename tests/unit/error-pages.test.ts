/**
 * ═════════════════════════════════════════════════════════════════════
 * ERROR PAGES UNIT TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for 404 (Not Found) and Error Boundary pages.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'bun:test';

describe('Error Pages Existence', () => {
  it('should have not-found.tsx file in app directory', () => {
    const notFoundPath = 'src/app/not-found.tsx';
    const file = Bun.file(notFoundPath);
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have error.tsx file in app directory', () => {
    const errorPath = 'src/app/error.tsx';
    const file = Bun.file(errorPath);
    expect(file.size).toBeGreaterThan(0);
  });

  it('should have help page in localized routes', () => {
    const helpPath = 'src/app/[locale]/(public)/help/page.tsx';
    const file = Bun.file(helpPath);
    expect(file.size).toBeGreaterThan(0);
  });
});

describe('Error Page Structure', () => {
  it('not-found.tsx should export metadata and default component', async () => {
    const content = await Bun.file('src/app/not-found.tsx').text();

    expect(content).toContain('export const metadata');
    expect(content).toContain('export default function');
    expect(content).toContain('FileQuestion');
    expect(content).toContain('Página não encontrada');
  });

  it('error.tsx should be a client component with error handling', async () => {
    const content = await Bun.file('src/app/error.tsx').text();

    expect(content).toContain("'use client'");
    expect(content).toContain('export default function');
    expect(content).toContain('error: Error');
    expect(content).toContain('reset: () => void');
    expect(content).toContain('AlertTriangle');
    expect(content).toContain('Algo deu errado');
  });

  it('help page should have FAQ accordion structure', async () => {
    const content = await Bun.file(
      'src/app/[locale]/(public)/help/page.tsx'
    ).text();

    expect(content).toContain('Accordion');
    expect(content).toContain('AccordionItem');
    expect(content).toContain('AccordionTrigger');
    expect(content).toContain('AccordionContent');
    expect(content).toContain('Como podemos ajudar?');
  });
});

describe('Error Page Components', () => {
  it('not-found page should have proper Next.js metadata', async () => {
    const content = await Bun.file('src/app/not-found.tsx').text();

    expect(content).toMatch(/title:\s*['"](Página não encontrada|.*404.*)/);
    expect(content).toContain('robots:');
    expect(content).toContain('index: false');
  });

  it('error page should use useEffect for logging', async () => {
    const content = await Bun.file('src/app/error.tsx').text();

    expect(content).toContain('useEffect');
    expect(content).toContain('console.error');
    expect(content).toMatch(/\[error\]/);
  });

  it('error page should display development details', async () => {
    const content = await Bun.file('src/app/error.tsx').text();

    expect(content).toContain('NODE_ENV');
    expect(content).toContain('development');
    expect(content).toContain('details'); // JSX, not HTML
    expect(content).toContain('error.stack');
  });
});

describe('Error Page UI Elements', () => {
  it('not-found page should have navigation buttons', async () => {
    const content = await Bun.file('src/app/not-found.tsx').text();

    expect(content).toContain('<Button');
    expect(content).toContain('href="/"');
    expect(content).toContain('Voltar para o início');
    expect(content).toContain('href="/help"');
  });

  it('error page should have retry and home buttons', async () => {
    const content = await Bun.file('src/app/error.tsx').text();

    expect(content).toContain('onClick={reset}');
    expect(content).toContain('Tentar novamente');
    expect(content).toContain('href="/"');
    expect(content).toContain('Voltar para o início');
  });

  it('both pages should use consistent styling classes', async () => {
    const notFoundContent = await Bun.file('src/app/not-found.tsx').text();
    const errorContent = await Bun.file('src/app/error.tsx').text();

    // Both should use flex centering
    expect(notFoundContent).toContain('flex');
    expect(notFoundContent).toContain('items-center');
    expect(notFoundContent).toContain('justify-center');

    expect(errorContent).toContain('flex');
    expect(errorContent).toContain('items-center');
    expect(errorContent).toContain('justify-center');
  });
});
