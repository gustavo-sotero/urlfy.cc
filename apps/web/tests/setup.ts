// apps/web/tests/setup.ts
// Global test setup for web app — runs before all tests

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

// Root .env.test is 3 levels up: tests/ → web/ → apps/ → root/
loadEnvFile(resolve(__dirname, '../../../.env.test'));

const requiredSecrets = [
  'JWT_SECRET',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET'
] as const;

for (const secret of requiredSecrets) {
  const secretValue = process.env[secret];

  if (!secretValue) {
    throw new Error(
      `Missing required test secret: ${secret}\n` +
        'Please ensure .env.test exists with all required secrets.\n' +
        'Generate secrets with: openssl rand -base64 32'
    );
  }

  if (secretValue.length < 32) {
    throw new Error(
      `Test secret ${secret} must be at least 32 characters long.\n` +
        'Current length: ' +
        secretValue.length +
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
    message: 'Web test environment configured',
    timestamp: new Date().toISOString()
  })}\n`
);

// ═══════════════════════════════════════════════════════════════════
// HAPPY DOM FOR REACT TESTING
// ═══════════════════════════════════════════════════════════════════
import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
global.window = window as any;
// biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
global.document = document as any;
// biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
global.navigator = window.navigator as any;
// biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
global.HTMLElement = window.HTMLElement as any;
// biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
global.Element = window.Element as any;
