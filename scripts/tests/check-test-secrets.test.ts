import { describe, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('../check-test-secrets.ts', import.meta.url)
).replaceAll('\\', '/');

const secureEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://urlfy:password@localhost:5432/urlfy',
  NEXT_PUBLIC_APP_URL: 'https://urlfy.cc',
  TRUST_PROXY: 'true',
  TRUST_PROXY_HOPS: '1',
  BETTER_AUTH_SECRET: 'better-auth-ci-value-minimum-32-chars',
  AUTH_SECRET: 'auth-ci-value-minimum-32-characters-long',
  JWT_SECRET: 'jwt-ci-value-minimum-32-characters-long',
  INTERNAL_API_SECRET: 'internal-api-ci-value-minimum-32-chars',
  INTERNAL_ANALYTICS_SECRET: 'analytics-ci-value-minimum-32-chars',
  ADMIN_GITHUB_ACCOUNT_ID: '123456789'
} satisfies Record<string, string>;

async function runCheck(extraEnv: Record<string, string | undefined>) {
  const env = {
    ...process.env,
    ...secureEnv
  } satisfies Record<string, string | undefined>;

  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) {
      delete env[key];
      continue;
    }

    env[key] = value;
  }

  const proc = Bun.spawn(['bun', scriptPath], {
    env,
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  return { stdout, stderr, exitCode };
}

function expectExitCode(
  result: Awaited<ReturnType<typeof runCheck>>,
  expectedExitCode: number
) {
  if (result.exitCode !== expectedExitCode) {
    throw new Error(
      `Expected exit code ${expectedExitCode}, received ${result.exitCode}.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
  }
}

describe('check-test-secrets guard', () => {
  test('passes with the full mandatory production runtime set', async () => {
    const result = await runCheck({});

    expectExitCode(result, 0);
    expect(result.stdout).toContain(
      'Runtime secrets and mandatory config look safe'
    );
  });

  test('fails when ADMIN_GITHUB_ACCOUNT_ID is missing', async () => {
    const result = await runCheck({ ADMIN_GITHUB_ACCOUNT_ID: '' });

    expectExitCode(result, 1);
    expect(result.stderr).toContain('ADMIN_GITHUB_ACCOUNT_ID: Not set');
  });

  test('fails when analytics secret reuses the Better Auth secret', async () => {
    const result = await runCheck({
      INTERNAL_ANALYTICS_SECRET: secureEnv.BETTER_AUTH_SECRET
    });

    expectExitCode(result, 1);
    expect(result.stderr).toContain(
      'INTERNAL_ANALYTICS_SECRET: Must differ from BETTER_AUTH_SECRET'
    );
  });

  test('fails on placeholder-style secret values', async () => {
    const result = await runCheck({
      BETTER_AUTH_SECRET: 'your-super-secret-key-min-32-chars-change-this'
    });

    expectExitCode(result, 1);
    expect(result.stderr).toContain('BETTER_AUTH_SECRET');
    expect(result.stderr).toContain('Contains test secret pattern');
  });

  test('fails when a public production origin disables TRUST_PROXY', async () => {
    const result = await runCheck({ TRUST_PROXY: 'false' });

    expectExitCode(result, 1);
    expect(result.stderr).toContain('TRUST_PROXY / NEXT_PUBLIC_APP_URL');
    expect(result.stderr).toContain('TRUST_PROXY must be true');
  });

  test('fails when TRUST_PROXY_HOPS is invalid', async () => {
    const result = await runCheck({ TRUST_PROXY_HOPS: '0' });

    expectExitCode(result, 1);
    expect(result.stderr).toContain('TRUST_PROXY_HOPS');
    expect(result.stderr).toContain('positive integer');
  });

  test('fails when TRUST_PROXY_PROVIDER is invalid', async () => {
    const result = await runCheck({ TRUST_PROXY_PROVIDER: 'nginx' });

    expectExitCode(result, 1);
    expect(result.stderr).toContain('TRUST_PROXY_PROVIDER');
    expect(result.stderr).toContain('"cloudflare" or "standard"');
  });
});
