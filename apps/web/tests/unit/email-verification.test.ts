import { describe, expect, it } from 'bun:test';
import {
  buildEmailVerificationCallbackUrl,
  buildEmailVerificationResultPath,
  buildPostVerificationLoginPath
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

  it('builds a localized login path that returns to the dashboard after sign-in', () => {
    const loginPath = buildPostVerificationLoginPath('en');
    const loginUrl = new URL(loginPath, 'https://urlfy.cc');

    expect(loginUrl.pathname).toBe('/en/login');
    expect(loginUrl.searchParams.get('callbackUrl')).toBe('/en/dashboard');
  });
});
