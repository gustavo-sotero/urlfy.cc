// apps/api/tests/setup.ts
// Global test setup for @urlfy/api — runs before all tests

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES (must be set FIRST - before any imports)
// ═══════════════════════════════════════════════════════════════════

function loadEnvFile(envPath: string): void {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    }
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        level: 'warn',
        message: '.env.test file not found, using environment variables',
        timestamp: new Date().toISOString()
      })}\n`
    );
  }
}

// Root .env.test is 3 levels up: tests/ → api/ → apps/ → root/
loadEnvFile(resolve(__dirname, '../../../.env.test'));

// Keep integration tests aligned with production guest-id hardening:
// guest identity signing requires INTERNAL_API_SECRET (or dedicated guest secret).
// For legacy test env files that only define AUTH_SECRET/BETTER_AUTH_SECRET,
// derive INTERNAL_API_SECRET so guest flows do not fail with 500.
if (!process.env.INTERNAL_API_SECRET) {
  process.env.INTERNAL_API_SECRET =
    process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || '';
}

const requiredTestEnv = [
  'JWT_SECRET',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'INTERNAL_API_SECRET',
  'ADMIN_GITHUB_ACCOUNT_ID'
] as const;

for (const envVar of requiredTestEnv) {
  const envValue = process.env[envVar];

  if (!envValue) {
    throw new Error(
      `Missing required test environment variable: ${envVar}\n` +
        'Please ensure .env.test exists with all required secrets.\n' +
        'Generate secrets with: openssl rand -base64 32'
    );
  }

  if (envVar === 'ADMIN_GITHUB_ACCOUNT_ID') {
    continue;
  }

  if (envValue.length < 32) {
    throw new Error(
      `Test secret ${envVar} must be at least 32 characters long.\n` +
        'Current length: ' +
        envValue.length +
        '\n' +
        'Generate a secure secret with: openssl rand -base64 32'
    );
  }
}

Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });

// ═══════════════════════════════════════════════════════════════════
// LOGTAPE MOCK (prevents configure() errors in tests)
// ═══════════════════════════════════════════════════════════════════
import { mock } from 'bun:test';

mock.module('@logtape/logtape', () => ({
  getLogger: () => ({
    debug: () => {},
    info: () => {},
    warning: () => {},
    error: () => {},
    fatal: () => {},
    trace: () => {}
  }),
  configure: async () => {},
  reset: async () => {},
  getConsoleSink: () => () => {}
}));

mock.module('@logtape/otel', () => ({
  getOpenTelemetrySink: () => () => {}
}));
mock.module('@logtape/redaction', () => ({
  redactByField: (_sink: unknown) => _sink,
  DEFAULT_REDACT_FIELDS: []
}));
mock.module('@logtape/drizzle-orm', () => ({
  getLogger: () => ({ logQuery: () => {} })
}));

process.stdout.write(
  `${JSON.stringify({
    level: 'info',
    message: 'API test environment configured',
    timestamp: new Date().toISOString()
  })}\n`
);
