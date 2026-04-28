import { afterEach, describe, expect, it } from 'bun:test';
import { assertCorsConfigSafe, isOriginAllowed } from '@/server/config/cors';

const ORIGINAL_TRUSTED_ORIGINS = process.env.TRUSTED_ORIGINS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  // Use delete when the original value was absent to avoid writing the
  // string "undefined" into process.env, which would cause origin
  // validation to throw on subsequent tests.
  if (ORIGINAL_TRUSTED_ORIGINS === undefined) {
    delete process.env.TRUSTED_ORIGINS;
  } else {
    process.env.TRUSTED_ORIGINS = ORIGINAL_TRUSTED_ORIGINS;
  }
  const mutableEnv = process.env as Record<string, string | undefined>;
  mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('CORS config safety', () => {
  it('throws when wildcard origin is configured', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';
    process.env.TRUSTED_ORIGINS = '*';

    expect(() => assertCorsConfigSafe()).toThrow(/Misconfiguration detected/);
  });

  it('throws when trusted origin is malformed', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';
    process.env.TRUSTED_ORIGINS = 'not-a-valid-origin';

    expect(() => assertCorsConfigSafe()).toThrow(/invalid origin/i);
  });

  it('does not throw for explicit trusted origins', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';
    process.env.TRUSTED_ORIGINS =
      'https://app.example.com,https://api.example.com';

    expect(() => assertCorsConfigSafe()).not.toThrow();
  });

  it('normalizes trusted origin entries before matching', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';
    process.env.TRUSTED_ORIGINS = 'https://app.example.com/some/path';

    expect(isOriginAllowed('https://app.example.com')).toBe(true);
  });

  it('fails closed for malformed trusted origins in runtime checks', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';
    process.env.TRUSTED_ORIGINS = 'not-a-valid-origin';

    expect(isOriginAllowed('https://urlfy.cc')).toBe(false);
  });
});

describe('CORS origin allowlist exact-match enforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = originalNodeEnv;
    delete process.env.TRUSTED_ORIGINS;
  });

  it('rejects localhost.attacker.com substring-spoofing attack', () => {
    // The old `origin.includes("localhost")` approach would accept this.
    // Exact protocol+host+port comparison must reject it.
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'development';
    expect(isOriginAllowed('http://localhost.attacker.com')).toBe(false);
    expect(isOriginAllowed('http://localhost.attacker.com:3000')).toBe(false);
  });

  it('accepts exact localhost:3000 in development', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'development';
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
  });

  it('rejects a different port on localhost', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'development';
    expect(isOriginAllowed('http://localhost:9999')).toBe(false);
  });

  it('rejects production origins in development without explicit allow', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'development';
    expect(isOriginAllowed('https://urlfy.cc')).toBe(false);
  });
});
