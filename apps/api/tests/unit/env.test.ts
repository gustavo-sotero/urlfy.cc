import { afterEach, describe, expect, test } from 'bun:test';

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

async function importFreshEnvModule(suffix: string) {
  return import(`../../src/lib/env.ts?api-env-test=${suffix}`);
}

afterEach(() => {
  restoreEnv();
});

describe('api env validation', () => {
  test('requires ADMIN_GITHUB_ACCOUNT_ID at runtime', async () => {
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.DATABASE_URL =
      'postgresql://urlfy_test:urlfy_test_pass@localhost:5432/urlfy_test';
    mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mutableEnv.BETTER_AUTH_SECRET = 'ci-test-secret-minimum-32-characters-long';
    mutableEnv.INTERNAL_API_SECRET =
      'ci-test-internal-secret-minimum-32-characters';
    delete mutableEnv.ADMIN_GITHUB_ACCOUNT_ID;
    delete mutableEnv.SKIP_ENV_VALIDATION;

    const { validateEnv } = await importFreshEnvModule('missing-admin-id');

    expect(() => validateEnv()).toThrow('ADMIN_GITHUB_ACCOUNT_ID is required');
  });

  test('accepts ADMIN_GITHUB_ACCOUNT_ID when provided', async () => {
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.DATABASE_URL =
      'postgresql://urlfy_test:urlfy_test_pass@localhost:5432/urlfy_test';
    mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mutableEnv.BETTER_AUTH_SECRET = 'ci-test-secret-minimum-32-characters-long';
    mutableEnv.INTERNAL_API_SECRET =
      'ci-test-internal-secret-minimum-32-characters';
    mutableEnv.ADMIN_GITHUB_ACCOUNT_ID =
      'ci-test-admin-github-account-id-00000000';
    delete mutableEnv.SKIP_ENV_VALIDATION;

    const { validateEnv } = await importFreshEnvModule('valid-admin-id');
    const env = validateEnv();

    expect(env.ADMIN_GITHUB_ACCOUNT_ID).toBe(
      'ci-test-admin-github-account-id-00000000'
    );
  });
});
