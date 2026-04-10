/**
 * Tests for localized signup callbackURL behaviour.
 *
 * Source-pattern assertions keep this test lightweight and stable when run
 * from the workspace root without a DOM preload.
 */

import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readSignupPageSource(): Promise<string> {
  const signupPagePath = resolve(
    import.meta.dir,
    '../../src/app/[locale]/(auth)/signup/page.tsx'
  );

  return readFile(signupPagePath, 'utf-8');
}

describe('SignupPage — localized auth callbackURL contract', () => {
  it('imports the email verification callback helper', async () => {
    const source = await readSignupPageSource();

    expect(source).toContain('@/lib/email-verification');
    expect(source).toContain('buildEmailVerificationCallbackUrl');
  });

  it('imports and uses useLocale from next-intl', async () => {
    const source = await readSignupPageSource();

    expect(source).toContain('useLocale');
    expect(source).toMatch(/const\s+locale\s*=\s*useLocale\(\)/);
  });

  it('builds an absolute localized public verification callback URL', async () => {
    const source = await readSignupPageSource();

    expect(source).toMatch(
      /buildEmailVerificationCallbackUrl\(window\.location\.origin, locale\)/
    );
  });

  it('passes the localized callbackURL to signUp.email', async () => {
    const source = await readSignupPageSource();

    expect(source).toMatch(
      /signUp\.email\s*\(\s*\{[\s\S]*callbackURL:\s*buildEmailVerificationCallbackURL\(\)/
    );
  });

  it('keeps the protected dashboard callback only for social signup', async () => {
    const source = await readSignupPageSource();
    const protectedDashboardCallbacks =
      source.match(/callbackURL:\s*buildDashboardCallbackURL\(\)/g) ?? [];

    expect(protectedDashboardCallbacks).toHaveLength(1);
    expect(source).toMatch(
      /signIn\.social\s*\(\s*\{[\s\S]*callbackURL:\s*buildDashboardCallbackURL\(\)/
    );
  });
});
