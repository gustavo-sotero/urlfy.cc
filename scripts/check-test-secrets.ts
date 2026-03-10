#!/usr/bin/env bun
/**
 * CI Guard: Check for Test Secrets in Production
 * ═══════════════════════════════════════════════════════════════════
 * Run in CI before deployment: bun run scripts/check-test-secrets.ts
 * Prevents accidental deployment with weak test secrets
 */

const KNOWN_TEST_SECRETS = [
  'test-secret-key-for-unit-tests',
  'test-better-auth-secret',
  'test-auth-secret-for-testing',
  'test-jwt-secret',
  'test-secret',
  'test-password'
];

const secretsToCheck = [
  { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
  { name: 'BETTER_AUTH_SECRET', value: process.env.BETTER_AUTH_SECRET },
  { name: 'AUTH_SECRET', value: process.env.AUTH_SECRET },
  { name: 'INTERNAL_API_SECRET', value: process.env.INTERNAL_API_SECRET },
  // INTERNAL_ANALYTICS_SECRET is optional but must not be weak if provided
  ...(process.env.INTERNAL_ANALYTICS_SECRET
    ? [
        {
          name: 'INTERNAL_ANALYTICS_SECRET',
          value: process.env.INTERNAL_ANALYTICS_SECRET
        }
      ]
    : [])
];

let hasTestSecrets = false;

console.log('🔍 Checking for test secrets in environment...\n');

for (const { name, value } of secretsToCheck) {
  if (!value) {
    console.log(`⚠️  ${name}: Not set (will fail in production)`);
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
    console.error(`   Current value: ${value.substring(0, 20)}...`);
    hasTestSecrets = true;
  } else {
    // Check minimum length
    if (value.length < 32) {
      console.error(
        `❌ ${name}: Too short (${value.length} chars, minimum 32 required)`
      );
      hasTestSecrets = true;
    } else {
      console.log(`✅ ${name}: OK (${value.length} chars)`);
    }
  }
}

console.log('');

if (hasTestSecrets) {
  console.error('❌ FAILED: Test secrets detected in environment!');
  console.error('');
  console.error('Action required:');
  console.error('1. Generate secure secrets: openssl rand -base64 32');
  console.error('2. Update environment variables in deployment configuration');
  console.error('3. Never use test secrets in production');
  console.error('');
  process.exit(1);
}

console.log('✅ No test secrets detected in environment');
console.log('✅ All secrets meet minimum security requirements');
process.exit(0);
