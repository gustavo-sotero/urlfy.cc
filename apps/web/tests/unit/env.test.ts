import { afterEach, describe, expect, test } from 'bun:test';
import { validateEnv } from '@/lib/env';

const mutableEnv = process.env as Record<string, string | undefined>;
const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete mutableEnv[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    mutableEnv[key] = value;
  }
}

afterEach(() => {
  restoreEnv();
});

describe('web env validation', () => {
  test('rejects leaked build-time sentinel secrets at runtime', () => {
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.DATABASE_URL =
      'postgresql://urlfy_test:urlfy_test_pass@localhost:5432/urlfy_test';
    mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mutableEnv.BETTER_AUTH_SECRET = 'build-time-placeholder-secret-32chars-xx';
    mutableEnv.INTERNAL_API_SECRET =
      'ci-test-internal-secret-minimum-32-characters';
    mutableEnv.INTERNAL_ANALYTICS_SECRET =
      'ci-test-analytics-secret-minimum-32-characters';
    mutableEnv.JWT_SECRET = 'ci-test-jwt-secret-minimum-32-characters';
    delete mutableEnv.SKIP_ENV_VALIDATION;

    expect(() => validateEnv()).toThrow(
      'BETTER_AUTH_SECRET contains a build-time placeholder value'
    );
  });
});
