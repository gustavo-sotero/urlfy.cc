/**
 * Tests for VerificationWarning component behaviour.
 *
 * Test strategy: source-pattern verification (same style as auth-runtime-parity)
 * so the test runs correctly from the workspace root without the happy-dom
 * preload that is only loaded when bun test is invoked from apps/web.
 *
 * Behaviour verified:
 *  1. Component uses `useLocale()` to obtain the active locale.
 *  2. The callbackURL passed to sendVerificationEmail uses the shared
 *     public email verification callback helper instead of pointing at the
 *     protected dashboard.
 *  3. Component detects the `?welcome=true` search param for post-signup UX.
 *  4. The `justSentTitle` i18n key is referenced for the post-signup state.
 */

import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readComponentSource(): Promise<string> {
  const componentPath = resolve(
    import.meta.dir,
    '../../src/components/dashboard/verification-warning.tsx'
  );
  return readFile(componentPath, 'utf-8');
}

describe('VerificationWarning — locale-aware callbackURL contract', () => {
  it('imports the email verification callback helper', async () => {
    const source = await readComponentSource();
    expect(source).toContain('@/lib/email-verification');
    expect(source).toContain('buildEmailVerificationCallbackUrl');
  });

  it('imports useLocale from next-intl', async () => {
    const source = await readComponentSource();
    expect(source).toContain('useLocale');
    // Must be imported, not just referenced
    expect(source).toMatch(/from 'next-intl'/);
  });

  it('calls useLocale() at the component level', async () => {
    const source = await readComponentSource();
    // const locale = useLocale() pattern
    expect(source).toMatch(/const\s+locale\s*=\s*useLocale\(\)/);
  });

  it('uses locale variable in the callback helper passed to sendVerificationEmail', async () => {
    const source = await readComponentSource();
    expect(source).toMatch(
      /callbackURL:\s*buildEmailVerificationCallbackUrl\(\s*window\.location\.origin,\s*locale\s*\)/
    );
  });

  it('does not point the verification callback directly at /dashboard', async () => {
    const source = await readComponentSource();
    expect(source).not.toContain('/dashboard`');
  });
});

describe('VerificationWarning — post-signup state contract', () => {
  it('imports useSearchParams from next/navigation', async () => {
    const source = await readComponentSource();
    expect(source).toContain('useSearchParams');
    expect(source).toMatch(/from 'next\/navigation'/);
  });

  it('reads the welcome search param to detect post-signup arrival', async () => {
    const source = await readComponentSource();
    expect(source).toContain("searchParams.get('welcome')");
    expect(source).toMatch(/welcome.*true/);
  });

  it('references justSentTitle i18n key for the post-signup banner', async () => {
    const source = await readComponentSource();
    expect(source).toContain("t('justSentTitle')");
  });

  it('references justSentDescription i18n key with email interpolation', async () => {
    const source = await readComponentSource();
    expect(source).toContain("t('justSentDescription'");
    expect(source).toContain('email');
  });

  it('wraps inner component in Suspense for useSearchParams compatibility', async () => {
    const source = await readComponentSource();
    expect(source).toContain('Suspense');
    expect(source).toMatch(/from 'react'/);
  });
});
