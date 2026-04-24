/**
 * Tests for localized login callbackURL behaviour.
 *
 * Source-pattern assertions keep this test lightweight and stable when run
 * from the workspace root without a DOM preload.
 */

import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readLoginPageSource(): Promise<string> {
  const loginPagePath = resolve(
    import.meta.dir,
    '../../src/app/[locale]/(auth)/login/page.tsx'
  );

  return readFile(loginPagePath, 'utf-8');
}

describe('LoginPage — localized auth callbackURL contract', () => {
  it('imports the shared post-login callback helpers', async () => {
    const source = await readLoginPageSource();

    expect(source).toContain('@/lib/email-verification');
    expect(source).toContain('buildPostLoginCallbackPath');
    expect(source).toContain('buildPostLoginCallbackUrl');
  });

  it('imports and uses useLocale from next-intl', async () => {
    const source = await readLoginPageSource();

    expect(source).toContain('useLocale');
    expect(source).toMatch(/const\s+locale\s*=\s*useLocale\(\)/);
  });

  it('normalizes in-app redirects through the shared callback path helper', async () => {
    const source = await readLoginPageSource();

    expect(source).toMatch(
      /const\s+callbackPath\s*=\s*buildPostLoginCallbackPath\(locale, rawCallbackUrl\)/
    );
    expect(source).toMatch(/router\.push\(callbackPath\)/);
  });

  it('passes an absolute localized callbackURL to social sign-in', async () => {
    const source = await readLoginPageSource();

    expect(source).toMatch(
      /buildPostLoginCallbackUrl\(window\.location\.origin, locale, rawCallbackUrl\)/
    );
    expect(source).toMatch(
      /signIn\.social\s*\(\s*\{[\s\S]*callbackURL:\s*buildOAuthCallbackURL\(\)/
    );
  });
});
