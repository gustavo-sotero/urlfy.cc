import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

const originalEnv = { ...process.env };
const mutableEnv = process.env as Record<string, string | undefined>;
let indexImportCounter = 0;

async function importFreshIndex() {
  return import(`../index?auth-shared-root=${indexImportCounter++}`) as Promise<
    typeof import('../index')
  >;
}

beforeEach(() => {
  mutableEnv.NODE_ENV = 'development';
  delete mutableEnv.BETTER_AUTH_SECRET;
  delete mutableEnv.SKIP_ENV_VALIDATION;
  delete mutableEnv.NEXT_PHASE;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete mutableEnv[key];
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    mutableEnv[key] = value;
  }
});

describe('@urlfy/auth-shared root entry', () => {
  it('remains importable without Better Auth runtime secrets', async () => {
    const module = await importFreshIndex();

    expect(module.ADMIN_ELEVATION_LOGIN_METHOD).toBeDefined();
    expect('baseAuthConfig' in module).toBe(false);
    expect('getAuthSecret' in module).toBe(false);
  });
});
