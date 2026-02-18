// tests/setup.ts
// Global test setup - runs before all tests

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES (must be set FIRST - before any imports)
// ═══════════════════════════════════════════════════════════════════

/**
 * Load environment variables from .env.test file
 * Uses Bun-native approach without external dotenv dependency
 */
function loadEnvFile(envPath: string): void {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove surrounding quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    }
  } catch {
    // .env.test file is optional, continue without it
    process.stderr.write(
      `${JSON.stringify({
        level: 'warn',
        message: '.env.test file not found, using environment variables',
        timestamp: new Date().toISOString()
      })}\n`
    );
  }
}

// Load test environment variables from .env.test
loadEnvFile(resolve(__dirname, '../.env.test'));

// Validate required test secrets are present and meet minimum length
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

// Ensure NODE_ENV is set to 'test'
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });

// ═══════════════════════════════════════════════════════════════════
// LOGTAPE MOCK (prevents configure() errors in tests)
// ═══════════════════════════════════════════════════════════════════
import { mock } from 'bun:test';

// Mock LogTape to prevent configure() errors and keep tests silent
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

// Mock LogTape integrations that depend on @logtape/logtape
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
    message: 'Test environment configured with secure secrets from .env.test',
    timestamp: new Date().toISOString()
  })}\n`
);

// ═══════════════════════════════════════════════════════════════════
// HAPPY DOM FOR REACT TESTING
// ═══════════════════════════════════════════════════════════════════
import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// Set up global variables for testing
// Happy-DOM provides a subset of browser APIs for testing purposes
// Using biome-ignore to suppress type compatibility warnings since
// Happy-DOM intentionally provides a minimal DOM implementation
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
