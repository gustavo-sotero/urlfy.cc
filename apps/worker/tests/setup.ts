// apps/worker/tests/setup.ts
// Global test setup for worker app — runs before all tests

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    // .env.test is optional
  }
}

// Root .env.test is 3 levels up: tests/ → worker/ → apps/ → root/
loadEnvFile(resolve(__dirname, '../../../.env.test'));

Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });

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
