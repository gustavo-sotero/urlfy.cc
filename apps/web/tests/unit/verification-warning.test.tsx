/**
 * Tests for VerificationWarning component behaviour.
 *
 * Test strategy: source-pattern verification (same style as auth-runtime-parity)
 * so the test runs correctly from the workspace root without the happy-dom
 * preload that is only loaded when bun test is invoked from apps/web.
 *
 * Behaviour verified:
 *  1. Component uses `useLocale()` to obtain the active locale.
 *  2. The callbackURL passed to sendVerificationEmail includes the locale
 *     segment, not a bare /dashboard path that would be swallowed by the
 *     shortlink proxy or cause a 404.
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

  it('uses locale variable in the callbackURL passed to sendVerificationEmail', async () => {
    const source = await readComponentSource();
    // The callbackURL must contain the locale segment before /dashboard
    // Pattern: `/${locale}/dashboard` or `${...}/${locale}/dashboard`
    expect(source).toMatch(/`.*\$\{.*locale.*\}.*\/dashboard`/);
  });

  it('does not use a bare /dashboard callbackURL', async () => {
    const source = await readComponentSource();
    // The old broken pattern was `${window.location.origin}/dashboard` (no locale).
    // After the fix, the locale variable must appear between the origin and /dashboard.
    expect(source).not.toContain('origin}/dashboard`');
  });
});
