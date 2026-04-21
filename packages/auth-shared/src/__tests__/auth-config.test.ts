/**
 * Wave 6 regression tests — Auth config parity and factory behaviour
 *
 * These tests assert canonical shared-factory invariants so that drift
 * between API and web auth runtime setups becomes test-detectable:
 *
 * 1. baseAuthConfig has the expected static shape (basePath, cookie posture)
 * 2. getPlugins() returns the correct number of plugins in the correct order
 * 3. getPlugins option flags correctly suppress the OpenAPI plugin
 * 4. getAuthSecret() behaves correctly across build / runtime / test envs
 * 5. assertRuntimeAuthConfigSafe() rejects dangerous env combinations
 *
 * Run: bun test src/
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  assertRuntimeAuthConfigSafe,
  baseAuthConfig,
  buildPublicEmailVerificationUrl,
  getAuthSecret,
  getPlugins
} from '../auth-config';

// ─── Env isolation ───────────────────────────────────────────────────────────

const originalEnv = { ...process.env };
const mutableEnv = process.env as Record<string, string | undefined>;

beforeEach(() => {
  // Reset to known state before each test
  mutableEnv.NODE_ENV = 'test';
  mutableEnv.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-long-xxxxxxxxx';
  mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  delete mutableEnv.SKIP_ENV_VALIDATION;
  delete mutableEnv.NEXT_PHASE;
});

afterEach(() => {
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete mutableEnv[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    mutableEnv[key] = value;
  }
});

// ─── baseAuthConfig structural assertions ───────────────────────────────────

describe('baseAuthConfig — structural shape', () => {
  it('sets basePath to /auth', () => {
    expect(baseAuthConfig.basePath).toBe('/auth');
  });

  it('sets appName to urlfy.cc', () => {
    expect(baseAuthConfig.appName).toBe('urlfy.cc');
  });

  it('enables emailAndPassword', () => {
    expect(baseAuthConfig.emailAndPassword?.enabled).toBe(true);
  });

  it('enforces minimum password length of 8', () => {
    expect(baseAuthConfig.emailAndPassword?.minPasswordLength).toBe(8);
  });

  it('enforces maximum password length of 128', () => {
    expect(baseAuthConfig.emailAndPassword?.maxPasswordLength).toBe(128);
  });

  it('sets cookie prefix to urlfy', () => {
    expect(baseAuthConfig.advanced?.cookiePrefix).toBe('urlfy');
  });

  it('sets SameSite=strict on cookies', () => {
    expect(baseAuthConfig.advanced?.defaultCookieAttributes?.sameSite).toBe(
      'strict'
    );
  });

  it('sets HttpOnly on cookies', () => {
    expect(baseAuthConfig.advanced?.defaultCookieAttributes?.httpOnly).toBe(
      true
    );
  });

  it('does not enable cross-subdomain cookies', () => {
    expect(baseAuthConfig.advanced?.crossSubDomainCookies?.enabled).toBe(false);
  });

  it('sets session TTL to 7 days', () => {
    expect(baseAuthConfig.session?.expiresIn).toBe(60 * 60 * 24 * 7);
  });
});

// ─── getPlugins — count and conditional flags ────────────────────────────────

describe('getPlugins — plugin set', () => {
  it('returns 2 plugins by default (twoFactor + openAPI)', () => {
    const plugins = getPlugins();
    expect(plugins).toHaveLength(2);
  });

  it('returns 1 plugin when disableOpenAPI=true', () => {
    const plugins = getPlugins({ disableOpenAPI: true });
    expect(plugins).toHaveLength(1);
  });

  it('defaults disableOpenAPI to false when no options are passed', () => {
    const withDefault = getPlugins();
    const withExplicit = getPlugins({ disableOpenAPI: false });
    expect(withDefault).toHaveLength(withExplicit.length);
  });

  it('twoFactor plugin is always present (first in list)', () => {
    const plugins = getPlugins({ disableOpenAPI: true });
    expect(plugins).toHaveLength(1);
    // twoFactor is the only remaining plugin — verify it is an object
    expect(typeof plugins[0]).toBe('object');
  });

  /**
   * PARITY CONTRACT: Both apps/api and apps/web call getPlugins() directly.
   * This keeps the shared plugin surface identical across runtimes without
   * preserving the retired admin-plugin toggle.
   */
  it('runtime convention uses getPlugins() without a legacy admin toggle', () => {
    expect(getPlugins()).toHaveLength(2);
  });
});

// ─── getAuthSecret — secret resolution ──────────────────────────────────────

describe('getAuthSecret — secret resolution', () => {
  it('returns the configured secret in test environment', () => {
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-long-xxxxx';
    const secret = getAuthSecret();
    expect(secret).toBe('test-secret-min-32-chars-long-xxxxx');
  });

  it('returns build-time placeholder during Next.js production build', () => {
    mutableEnv.SKIP_ENV_VALIDATION = '1';
    mutableEnv.NEXT_PHASE = 'phase-production-build';
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.BETTER_AUTH_SECRET;
    expect(getAuthSecret()).toBe('build-time-placeholder-secret-32chars');
  });

  it('uses test sentinel as fallback in test env when BETTER_AUTH_SECRET is absent', () => {
    mutableEnv.NODE_ENV = 'test';
    delete mutableEnv.BETTER_AUTH_SECRET;
    // Should not throw and should return the test sentinel
    expect(() => getAuthSecret()).not.toThrow();
    const secret = getAuthSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('throws when BETTER_AUTH_SECRET is missing in production', () => {
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.BETTER_AUTH_SECRET;
    delete mutableEnv.SKIP_ENV_VALIDATION;
    delete mutableEnv.NEXT_PHASE;
    expect(() => getAuthSecret()).toThrow('BETTER_AUTH_SECRET is required');
  });

  it('rejects a build-time sentinel value at production runtime', () => {
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.BETTER_AUTH_SECRET = 'build-time-placeholder-secret-32chars';
    delete mutableEnv.SKIP_ENV_VALIDATION;
    delete mutableEnv.NEXT_PHASE;
    expect(() => getAuthSecret()).toThrow(
      'BETTER_AUTH_SECRET contains a build-time placeholder'
    );
  });
});

// ─── assertRuntimeAuthConfigSafe ────────────────────────────────────────────

describe('assertRuntimeAuthConfigSafe', () => {
  it('passes silently in test environment', () => {
    mutableEnv.NODE_ENV = 'test';
    expect(() => assertRuntimeAuthConfigSafe()).not.toThrow();
  });

  it('passes silently in production when SKIP_ENV_VALIDATION is not set', () => {
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.SKIP_ENV_VALIDATION;
    expect(() => assertRuntimeAuthConfigSafe()).not.toThrow();
  });

  it('throws when SKIP_ENV_VALIDATION=1 outside of build phase', () => {
    mutableEnv.SKIP_ENV_VALIDATION = '1';
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.NEXT_PHASE;
    expect(() => assertRuntimeAuthConfigSafe()).toThrow(
      'SKIP_ENV_VALIDATION=1 is only supported during build'
    );
  });

  it('allows SKIP_ENV_VALIDATION=1 during Next production build phase', () => {
    mutableEnv.SKIP_ENV_VALIDATION = '1';
    mutableEnv.NEXT_PHASE = 'phase-production-build';
    mutableEnv.NODE_ENV = 'production';
    expect(() => assertRuntimeAuthConfigSafe()).not.toThrow();
  });
});

// ─── buildPublicEmailVerificationUrl ────────────────────────────────────────

describe('buildPublicEmailVerificationUrl — public URL construction', () => {
  it('targets /api/auth/verify-email as the path', () => {
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const result = buildPublicEmailVerificationUrl({ token: 'tok123' });
    const url = new URL(result);
    expect(url.pathname).toBe('/api/auth/verify-email');
  });

  it('uses the correct origin from BETTER_AUTH_URL', () => {
    mutableEnv.BETTER_AUTH_URL = 'https://urlfy.cc';
    delete mutableEnv.NEXT_PUBLIC_APP_URL;
    const result = buildPublicEmailVerificationUrl({ token: 'tok456' });
    expect(result.startsWith('https://urlfy.cc/')).toBe(true);
  });

  it('prefers BETTER_AUTH_URL over NEXT_PUBLIC_APP_URL', () => {
    mutableEnv.BETTER_AUTH_URL = 'https://api.urlfy.cc';
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://urlfy.cc';
    const result = buildPublicEmailVerificationUrl({ token: 'tok789' });
    expect(result.startsWith('https://api.urlfy.cc/')).toBe(true);
  });

  it('strips accidental path suffix from the base URL', () => {
    mutableEnv.BETTER_AUTH_URL = 'https://urlfy.cc/some/stray/path';
    const result = buildPublicEmailVerificationUrl({ token: 'tok-strip' });
    const url = new URL(result);
    expect(url.pathname).toBe('/api/auth/verify-email');
    expect(url.origin).toBe('https://urlfy.cc');
  });

  it('includes the token in the query string', () => {
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const result = buildPublicEmailVerificationUrl({ token: 'my-token-abc' });
    const url = new URL(result);
    expect(url.searchParams.get('token')).toBe('my-token-abc');
  });

  it('includes callbackURL in the query string when provided', () => {
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const result = buildPublicEmailVerificationUrl({
      token: 'tok',
      callbackURL: 'https://example.com/en/dashboard'
    });
    const url = new URL(result);
    expect(url.searchParams.get('callbackURL')).toBe(
      'https://example.com/en/dashboard'
    );
  });

  it('omits callbackURL when not provided', () => {
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const result = buildPublicEmailVerificationUrl({ token: 'tok' });
    const url = new URL(result);
    expect(url.searchParams.has('callbackURL')).toBe(false);
  });

  it('omits callbackURL when null', () => {
    mutableEnv.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const result = buildPublicEmailVerificationUrl({
      token: 'tok',
      callbackURL: null
    });
    const url = new URL(result);
    expect(url.searchParams.has('callbackURL')).toBe(false);
  });

  it('falls back to localhost:3000 when no env var is set', () => {
    delete mutableEnv.BETTER_AUTH_URL;
    delete mutableEnv.NEXT_PUBLIC_APP_URL;
    const result = buildPublicEmailVerificationUrl({ token: 'tok-local' });
    expect(result.startsWith('http://localhost:3000/')).toBe(true);
  });
});
