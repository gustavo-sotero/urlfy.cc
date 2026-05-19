#!/usr/bin/env bun
/**
 * CI Guard: Check for Test Secrets in Production
 * ═══════════════════════════════════════════════════════════════════
 * Run in CI before deployment: bun run scripts/check-test-secrets.ts
 * Prevents accidental deployment with weak test secrets
 */

import { assertTrustProxyConfig } from '../packages/telemetry/src/ip';

const KNOWN_TEST_SECRETS = [
  'build-time-placeholder',
  'change-this',
  'changeme',
  'placeholder',
  'test-secret-key-for-unit-tests',
  'test-better-auth-secret',
  'test-auth-secret-for-testing',
  'test-jwt-secret',
  'test-secret',
  'test-password',
  'your-'
];

const isProduction = process.env.NODE_ENV === 'production';

interface SecretCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  minLength: number;
}

interface ConfigCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  validate?: (value: string) => string | null;
}

const secretsToCheck: SecretCheck[] = [
  {
    name: 'BETTER_AUTH_SECRET',
    value: process.env.BETTER_AUTH_SECRET,
    required: true,
    minLength: 32
  },
  {
    name: 'AUTH_SECRET',
    value: process.env.AUTH_SECRET,
    required: false,
    minLength: 32
  },
  {
    name: 'JWT_SECRET',
    value: process.env.JWT_SECRET,
    required: isProduction,
    minLength: 32
  },
  {
    name: 'INTERNAL_API_SECRET',
    value: process.env.INTERNAL_API_SECRET,
    required: true,
    minLength: isProduction ? 32 : 16
  },
  {
    name: 'INTERNAL_ANALYTICS_SECRET',
    value: process.env.INTERNAL_ANALYTICS_SECRET,
    required: isProduction,
    minLength: isProduction ? 32 : 16
  },
  {
    name: 'IDEMPOTENCY_GUEST_SECRET',
    value: process.env.IDEMPOTENCY_GUEST_SECRET,
    required: false,
    minLength: 32
  }
];

const configToCheck: ConfigCheck[] = [
  {
    name: 'DATABASE_URL',
    value: process.env.DATABASE_URL,
    required: true,
    validate: (value) => {
      try {
        new URL(value);
        return null;
      } catch {
        return 'must be a valid database URL';
      }
    }
  },
  {
    name: 'ADMIN_GITHUB_ACCOUNT_ID',
    value: process.env.ADMIN_GITHUB_ACCOUNT_ID,
    required: true,
    validate: (value) => (value.trim() ? null : 'must not be empty')
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    value: process.env.NEXT_PUBLIC_APP_URL,
    required: false,
    validate: (value) => {
      try {
        new URL(value);
        return null;
      } catch {
        return 'must be a valid absolute URL';
      }
    }
  },
  {
    name: 'TRUST_PROXY',
    value: process.env.TRUST_PROXY,
    required: false,
    validate: (value) =>
      value === 'true' || value === 'false'
        ? null
        : 'must be either "true" or "false"'
  },
  {
    name: 'TRUST_PROXY_HOPS',
    value: process.env.TRUST_PROXY_HOPS,
    required: false,
    validate: (value) => {
      if (!value.trim()) {
        return 'must not be empty when set';
      }

      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed >= 1
        ? null
        : 'must be a positive integer';
    }
  },
  {
    name: 'TRUST_PROXY_PROVIDER',
    value: process.env.TRUST_PROXY_PROVIDER,
    required: false,
    validate: (value) =>
      value === 'cloudflare' || value === 'standard'
        ? null
        : 'must be either "cloudflare" or "standard"'
  }
];

let hasUnsafeConfig = false;

console.log('🔍 Checking runtime secrets and mandatory config...\n');

for (const { name, value, required, minLength } of secretsToCheck) {
  if (!value) {
    if (required) {
      console.error(`❌ ${name}: Not set (mandatory)`);
      hasUnsafeConfig = true;
    } else {
      console.log(`⚠️  ${name}: Not set (optional)`);
    }
    continue;
  }

  // Check if secret contains any known test patterns
  const matchedTestSecret = KNOWN_TEST_SECRETS.find((testSecret) =>
    value.toLowerCase().includes(testSecret.toLowerCase())
  );

  if (matchedTestSecret) {
    console.error(
      `❌ ${name}: Contains test secret pattern "${matchedTestSecret}"`
    );
    hasUnsafeConfig = true;
  } else {
    // Check minimum length
    if (value.length < minLength) {
      console.error(
        `❌ ${name}: Too short (${value.length} chars, minimum ${minLength} required)`
      );
      hasUnsafeConfig = true;
    } else {
      console.log(`✅ ${name}: OK (${value.length} chars)`);
    }
  }
}

for (const { name, value, required, validate } of configToCheck) {
  if (!value) {
    if (required) {
      console.error(`❌ ${name}: Not set (mandatory)`);
      hasUnsafeConfig = true;
    } else {
      console.log(`⚠️  ${name}: Not set (optional)`);
    }
    continue;
  }

  const validationError = validate?.(value) ?? null;
  if (validationError) {
    console.error(`❌ ${name}: ${validationError}`);
    hasUnsafeConfig = true;
  } else {
    console.log(`✅ ${name}: OK`);
  }
}

try {
  assertTrustProxyConfig({
    nodeEnv: process.env.NODE_ENV,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    trustProxy: process.env.TRUST_PROXY,
    trustedProxyHops: process.env.TRUST_PROXY_HOPS
  });

  if (process.env.NEXT_PUBLIC_APP_URL) {
    console.log('✅ TRUST_PROXY / NEXT_PUBLIC_APP_URL: OK');
  }
} catch (error) {
  console.error(
    `❌ TRUST_PROXY / NEXT_PUBLIC_APP_URL: ${error instanceof Error ? error.message : String(error)}`
  );
  hasUnsafeConfig = true;
}

if (
  process.env.INTERNAL_ANALYTICS_SECRET &&
  process.env.BETTER_AUTH_SECRET &&
  process.env.INTERNAL_ANALYTICS_SECRET === process.env.BETTER_AUTH_SECRET
) {
  console.error(
    '❌ INTERNAL_ANALYTICS_SECRET: Must differ from BETTER_AUTH_SECRET'
  );
  hasUnsafeConfig = true;
}

if (
  process.env.INTERNAL_API_SECRET &&
  process.env.BETTER_AUTH_SECRET &&
  process.env.INTERNAL_API_SECRET === process.env.BETTER_AUTH_SECRET
) {
  console.error('❌ INTERNAL_API_SECRET: Must differ from BETTER_AUTH_SECRET');
  hasUnsafeConfig = true;
}

console.log('');

if (hasUnsafeConfig) {
  console.error('❌ FAILED: Unsafe runtime secret/config detected!');
  console.error('');
  console.error('Action required:');
  console.error('1. Generate secure secrets: openssl rand -base64 32');
  console.error('2. Update environment variables in deployment configuration');
  console.error(
    '3. Never use test, placeholder, or shared secrets in production'
  );
  console.error('');
  process.exit(1);
}

console.log('✅ Runtime secrets and mandatory config look safe');
process.exit(0);
