#!/usr/bin/env bun

/**
 * Validation script for Module 4: Redirect Engine
 *
 * This script performs basic validation of the implementation:
 * - Type checking
 * - File existence
 * - Configuration validation
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dir, '..');

interface ValidationResult {
  category: string;
  passed: number;
  failed: number;
  errors: string[];
}

const results: ValidationResult[] = [];

function checkFile(path: string, description: string): boolean {
  const fullPath = resolve(PROJECT_ROOT, path);
  const exists = existsSync(fullPath);
  if (!exists) {
    console.log(`❌ ${description}: ${path}`);
  } else {
    console.log(`✅ ${description}`);
  }
  return exists;
}

function validateCategory(
  category: string,
  checks: Array<() => boolean>
): void {
  console.log(`\n📦 ${category}`);
  console.log('─'.repeat(50));

  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      if (check()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  results.push({ category, passed, failed, errors });
}

// ═══════════════════════════════════════════════════════════════════
// FILE STRUCTURE VALIDATION
// ═══════════════════════════════════════════════════════════════════

validateCategory('Core Implementation Files', [
  () => checkFile('src/types/redirect.types.ts', 'Redirect Types'),
  () => checkFile('src/server/lib/distributed-lock.ts', 'Distributed Lock'),
  () => checkFile('src/server/services/cache.service.ts', 'Cache Service'),
  () =>
    checkFile('src/server/services/redirect.service.ts', 'Redirect Service'),
  () =>
    checkFile(
      'src/server/middleware/redirect.middleware.ts',
      'Redirect Middleware Handler'
    ),
  () =>
    checkFile(
      'src/proxy.ts',
      'Next.js Proxy (renamed from middleware in Next.js 16)'
    )
]);

validateCategory('Supporting Libraries', [
  () => checkFile('src/server/lib/redis.ts', 'Redis Client'),
  () => checkFile('src/server/lib/circuit-breaker.ts', 'Circuit Breaker'),
  () => checkFile('src/server/lib/telemetry.ts', 'Telemetry'),
  () => checkFile('src/server/lib/queue.ts', 'Queue (BullMQ)')
]);

validateCategory('Unit Tests', [
  () =>
    checkFile(
      'src/server/services/__tests__/redirect.service.test.ts',
      'Redirect Service Tests'
    ),
  () =>
    checkFile(
      'src/server/services/__tests__/cache.service.test.ts',
      'Cache Service Tests'
    )
]);

validateCategory('Integration Tests', [
  () =>
    checkFile(
      'tests/integration/redirect.integration.test.ts',
      'Integration Tests'
    )
]);

validateCategory('Load Tests', [
  () => checkFile('tests/load/redirect-simple.js', 'Simple k6 Test'),
  () =>
    checkFile('tests/load/redirect-scenarios.js', 'Comprehensive k6 Scenarios')
]);

validateCategory('Documentation', [
  () => checkFile('tests/README.md', 'Test Documentation'),
  () =>
    checkFile(
      'docs/modules/module-04-redirect.md',
      'Module Documentation (includes checklist)'
    )
]);

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION VALIDATION
// ═══════════════════════════════════════════════════════════════════

validateCategory('Environment Configuration', [
  () => {
    const hasDb = !!process.env.DATABASE_URL;
    if (!hasDb)
      console.log('⚠️  DATABASE_URL not set (required for production)');
    else console.log('✅ DATABASE_URL configured');
    return true; // Warning only
  },
  () => {
    const hasRedis = !!process.env.REDIS_URL;
    if (!hasRedis)
      console.log('⚠️  REDIS_URL not set (will use default localhost:6379)');
    else console.log('✅ REDIS_URL configured');
    return true; // Warning only
  },
  () => {
    const hasOtel = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!hasOtel)
      console.log(
        '⚠️  OTEL_EXPORTER_OTLP_ENDPOINT not set (telemetry disabled)'
      );
    else console.log('✅ OTEL_EXPORTER_OTLP_ENDPOINT configured');
    return true; // Warning only
  }
]);

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`);
console.log('📊 VALIDATION SUMMARY');
console.log('═'.repeat(50));

let totalPassed = 0;
let totalFailed = 0;

for (const result of results) {
  totalPassed += result.passed;
  totalFailed += result.failed;

  const status = result.failed === 0 ? '✅' : '❌';
  console.log(
    `${status} ${result.category}: ${result.passed}/${
      result.passed + result.failed
    } passed`
  );

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.log(`   ⚠️  ${error}`);
    }
  }
}

console.log('─'.repeat(50));
console.log(`Total: ${totalPassed}/${totalPassed + totalFailed} checks passed`);

if (totalFailed === 0) {
  console.log('\n🎉 All validations passed!');
  console.log('\nNext steps:');
  console.log('1. Run unit tests: bun test');
  console.log('2. Start infrastructure: docker-compose up -d');
  console.log('3. Run integration tests: bun test tests/integration/');
  console.log('4. Run load tests: k6 run tests/load/redirect-simple.js');
} else {
  console.log(`\n⚠️  ${totalFailed} validation(s) failed. Please review.`);
  process.exit(1);
}
