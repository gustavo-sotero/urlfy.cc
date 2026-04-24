import { describe, expect, it } from 'bun:test';
import {
  buildEmailVerificationCallbackUrl,
  buildEmailVerificationResultPath,
  buildPostLoginCallbackPath,
  buildPostLoginCallbackUrl,
  buildPostSignupDashboardPath,
  buildPostVerificationLoginPath,
  isPostSignupVerificationSent
} from '@/lib/email-verification';

describe('email verification navigation helpers', () => {
  it('builds a localized public verification result path', () => {
    expect(buildEmailVerificationResultPath('pt-br')).toBe(
      '/pt-br/email-verification?verified=1'
    );
  });

  it('builds an absolute callback URL from the origin only', () => {
    expect(
      buildEmailVerificationCallbackUrl('https://urlfy.cc/stray/path', 'en')
    ).toBe('https://urlfy.cc/en/email-verification?verified=1');
  });

  it('builds the dedicated post-signup dashboard state', () => {
    expect(buildPostSignupDashboardPath()).toBe(
      '/dashboard?verificationEmail=sent'
    );
  });

  it('detects the dedicated post-signup verification state', () => {
    expect(
      isPostSignupVerificationSent(
        new URLSearchParams('verificationEmail=sent')
      )
    ).toBe(true);
    expect(
      isPostSignupVerificationSent(new URLSearchParams('welcome=true'))
    ).toBe(false);
  });

  it('builds a localized login path that returns to the dashboard after sign-in', () => {
    const loginPath = buildPostVerificationLoginPath('en');
    const loginUrl = new URL(loginPath, 'https://urlfy.cc');

    expect(loginUrl.pathname).toBe('/en/login');
    expect(loginUrl.searchParams.get('callbackUrl')).toBe('/en/dashboard');
  });

  it('localizes legacy dashboard callback paths before OAuth redirects back', () => {
    expect(buildPostLoginCallbackPath('pt-br', '/dashboard?from=oauth')).toBe(
      '/pt-br/dashboard?from=oauth'
    );
  });

  it('keeps root-level callback paths that intentionally bypass i18n', () => {
    expect(buildPostLoginCallbackPath('en', '/admin')).toBe('/admin');
  });

  it('preserves already localized dashboard callback paths', () => {
    expect(
      buildPostLoginCallbackPath('pt-br', '/pt-br/dashboard?tab=links')
    ).toBe('/pt-br/dashboard?tab=links');
  });

  it('falls back to the localized dashboard for external callback URLs', () => {
    expect(
      buildPostLoginCallbackPath('en', 'https://malicious.example/dashboard')
    ).toBe('/en/dashboard');
  });

  it('builds an absolute OAuth callback URL from the current origin', () => {
    expect(
      buildPostLoginCallbackUrl(
        'https://urlfy.cc/stray/path',
        'en',
        '/dashboard?from=oauth'
      )
    ).toBe('https://urlfy.cc/en/dashboard?from=oauth');
  });
});
