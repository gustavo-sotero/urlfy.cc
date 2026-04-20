/**
 * Tests for VerificationWarning component behaviour.
 *
 * Test strategy: source-pattern verification so the test remains stable when
 * run from the workspace root without the apps/web happy-dom preload.
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

describe('VerificationWarning — locale-aware resend contract', () => {
  it('imports the shared email verification helper utilities', async () => {
    const source = await readComponentSource();

    expect(source).toContain('@/lib/email-verification');
    expect(source).toContain('buildEmailVerificationCallbackUrl');
    expect(source).toContain('isPostSignupVerificationSent');
  });

  it('uses the localized public callback URL when resending the verification email', async () => {
    const source = await readComponentSource();

    expect(source).toMatch(
      /callbackURL:\s*buildEmailVerificationCallbackUrl\(\s*window\.location\.origin,\s*locale\s*\)/
    );
  });

  it('falls back to the server-provided email when the client session is not ready', async () => {
    const source = await readComponentSource();

    expect(source).toContain('session?.user?.email ?? email');
  });

  it('uses the localized fallback resend error copy instead of surfacing raw error text', async () => {
    const source = await readComponentSource();

    expect(source).toContain("setResendError(t('errorResend'))");
    expect(source).not.toContain('error instanceof Error ? error.message');
  });
});

describe('VerificationWarning — post-signup state contract', () => {
  it('detects the dedicated post-signup verification state instead of welcome=true', async () => {
    const source = await readComponentSource();

    expect(source).toContain('isPostSignupVerificationSent(searchParams)');
    expect(source).not.toContain("searchParams.get('welcome')");
    expect(source).not.toContain('welcome=true');
  });

  it('renders the post-signup confirmation without replacing the persistent reminder', async () => {
    const source = await readComponentSource();

    expect(source).toContain("t('justSentTitle')");
    expect(source).toContain("t('title')");
    expect(source).not.toMatch(/if\s*\(isNewSignup\)\s*\{\s*return/);
  });

  it('wraps the client implementation in Suspense for useSearchParams compatibility', async () => {
    const source = await readComponentSource();

    expect(source).toContain('Suspense');
    expect(source).toContain('fallback={null}');
  });
});
