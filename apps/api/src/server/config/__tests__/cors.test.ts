import { afterEach, describe, expect, it } from 'bun:test';
import { assertCorsConfigSafe, isOriginAllowed } from '@/server/config/cors';

const ORIGINAL_TRUSTED_ORIGINS = process.env.TRUSTED_ORIGINS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.TRUSTED_ORIGINS = ORIGINAL_TRUSTED_ORIGINS;
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
