import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { assertRuntimeAuthConfigSafe, getAuthSecret } from '@/lib/auth.config';

const originalEnv = { ...process.env };
const mutableEnv = process.env as Record<string, string | undefined>;

beforeAll(() => {
  mutableEnv.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-long';
  mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  mutableEnv.NODE_ENV = 'test';
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete mutableEnv[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    mutableEnv[key] = value;
  }
});

describe('auth config runtime hardening', () => {
  test('returns the build placeholder only during Next production build', () => {
    mutableEnv.SKIP_ENV_VALIDATION = '1';
    mutableEnv.NEXT_PHASE = 'phase-production-build';
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.BETTER_AUTH_SECRET;

    expect(getAuthSecret()).toBe('build-time-placeholder-secret-32chars');
  });

  test('rejects leaked runtime SKIP_ENV_VALIDATION bypass', () => {
    mutableEnv.SKIP_ENV_VALIDATION = '1';
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.NEXT_PHASE;

    expect(() => assertRuntimeAuthConfigSafe()).toThrow(
      'SKIP_ENV_VALIDATION=1 is only supported during build'
    );
  });

  test('rejects sentinel auth secrets outside test', () => {
    delete mutableEnv.SKIP_ENV_VALIDATION;
    delete mutableEnv.NEXT_PHASE;
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.BETTER_AUTH_SECRET = 'build-time-placeholder-secret-32chars';

    expect(() => getAuthSecret()).toThrow(
      'BETTER_AUTH_SECRET contains a build-time placeholder value'
    );
  });
});
