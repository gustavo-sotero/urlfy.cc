#!/usr/bin/env bun
/**
 * Infrastructure Validation Script
 * Validates that all Module 1 components are properly configured
 */

import { validateEnv } from '../src/lib/env';

interface ValidationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
}

const results: ValidationResult[] = [];

// ═══════════════════════════════════════════════════════════════════
// 1. ENVIRONMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════

console.log('\n🔍 Validating environment variables...\n');

try {
  validateEnv();
  results.push({
    category: 'Environment',
    checks: [
      {
        name: 'Environment variables',
        status: 'pass',
        message: 'All required variables are set'
      }
    ]
  });
} catch (_error) {
  // Check if .env file exists
  const envExists = await Bun.file('.env').exists();
  results.push({
    category: 'Environment',
    checks: [
      {
        name: 'Environment variables',
        status: envExists ? 'warn' : 'fail',
        message: envExists
          ? 'Some environment variables are not set. Review .env file.'
          : '.env file not found. Copy .env.example to .env and configure it.'
      }
    ]
  });
}

// ═══════════════════════════════════════════════════════════════════
// 2. FILE STRUCTURE VALIDATION
// ═══════════════════════════════════════════════════════════════════

console.log('🔍 Validating file structure...\n');

const requiredFiles = [
  // Docker
  'docker/docker-compose.yml',
  'docker/docker-compose.dev.yml',
  'docker/docker-compose.prod.yml',
  'docker/Dockerfile',
  'docker/crontab',
  'docker/signoz-otel-collector-config.yaml',

  // Scripts
  'scripts/backup.sh',

  // Server lib
  'src/server/lib/db.ts',
  'src/server/lib/redis.ts',
  'src/server/lib/queue.ts',
  'src/server/lib/telemetry.ts',
  'src/server/lib/metrics.ts',
  'src/server/lib/geoip.ts',

  // Server API
  'src/server/api/health.ts',
  'src/server/api/index.ts',

  // Server init
  'src/server/init.ts',

  // Database
  'src/db/index.ts',
  'src/db/schema.ts',
  'src/db/cli.ts',

  // Lib
  'src/lib/env.ts',
  'src/lib/auth.ts',
  'src/lib/auth.cli.ts',

  // Config
  'drizzle.config.ts',
  'next.config.ts',
  'tsconfig.json',
  'biome.json',
  'package.json',
  '.env.example'
];

const fileChecks = requiredFiles.map((file) => {
  const exists = Bun.file(file).size !== undefined;
  return {
    name: file,
    status: exists ? ('pass' as const) : ('fail' as const),
    message: exists ? undefined : 'File not found'
  };
});

results.push({
  category: 'File Structure',
  checks: fileChecks
});

// ═══════════════════════════════════════════════════════════════════
// 3. DOCKER COMPOSE VALIDATION
// ═══════════════════════════════════════════════════════════════════

console.log('🔍 Validating Docker Compose configuration...\n');

const dockerComposeFile = await Bun.file('docker/docker-compose.yml').text();
const requiredServices = [
  'app',
  'postgres',
  'redis',
  'signoz-otel-collector',
  'signoz-query-service',
  'signoz-frontend',
  'signoz-clickhouse',
  'geoipupdate',
  'backup'
];

const dockerChecks = requiredServices.map((service) => {
  const found = dockerComposeFile.includes(`${service}:`);
  return {
    name: `Service: ${service}`,
    status: found ? ('pass' as const) : ('fail' as const),
    message: found ? undefined : 'Service not defined in docker-compose.yml'
  };
});

results.push({
  category: 'Docker Services',
  checks: dockerChecks
});

// ═══════════════════════════════════════════════════════════════════
// 4. PACKAGE.JSON VALIDATION
// ═══════════════════════════════════════════════════════════════════

console.log('🔍 Validating package.json dependencies...\n');

const pkg = await Bun.file('package.json').json();
const requiredDeps = [
  '@maxmind/geoip2-node',
  '@opentelemetry/api',
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/sdk-node',
  'bullmq',
  'drizzle-orm',
  'elysia',
  'ioredis',
  'next',
  'zod'
];

const depChecks = requiredDeps.map((dep) => {
  const installed = dep in pkg.dependencies;
  return {
    name: dep,
    status: installed ? ('pass' as const) : ('fail' as const),
    message: installed ? undefined : 'Dependency not installed'
  };
});

results.push({
  category: 'Dependencies',
  checks: depChecks
});

// ═══════════════════════════════════════════════════════════════════
// 5. SCRIPTS VALIDATION
// ═══════════════════════════════════════════════════════════════════

console.log('🔍 Validating NPM scripts...\n');

const requiredScripts = [
  'dev',
  'build',
  'lint',
  'docker:up',
  'docker:down',
  'db:generate',
  'db:migrate'
];

const scriptChecks = requiredScripts.map((script) => {
  const exists = script in pkg.scripts;
  return {
    name: script,
    status: exists ? ('pass' as const) : ('fail' as const),
    message: exists ? undefined : 'Script not defined'
  };
});

results.push({
  category: 'NPM Scripts',
  checks: scriptChecks
});

// ═══════════════════════════════════════════════════════════════════
// PRINT RESULTS
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(70)}`);
console.log('📊 VALIDATION RESULTS');
console.log(`${'═'.repeat(70)}\n`);

let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;

for (const result of results) {
  const passed = result.checks.filter((c) => c.status === 'pass').length;
  const failed = result.checks.filter((c) => c.status === 'fail').length;
  const warned = result.checks.filter((c) => c.status === 'warn').length;

  totalPass += passed;
  totalFail += failed;
  totalWarn += warned;

  const emoji = failed > 0 ? '❌' : warned > 0 ? '⚠️' : '✅';
  console.log(
    `${emoji} ${result.category}: ${passed}/${result.checks.length} passed`
  );

  // Show failures and warnings
  for (const check of result.checks) {
    if (check.status === 'fail') {
      console.log(`   ❌ ${check.name}: ${check.message}`);
    } else if (check.status === 'warn') {
      console.log(`   ⚠️  ${check.name}: ${check.message}`);
    }
  }

  console.log('');
}

console.log('═'.repeat(70));
console.log(
  `Total: ${totalPass} passed, ${totalFail} failed, ${totalWarn} warnings`
);
console.log(`${'═'.repeat(70)}\n`);

// Exit with error if any checks failed
if (totalFail > 0) {
  console.error('❌ Validation failed! Please fix the errors above.');
  process.exit(1);
} else if (totalWarn > 0) {
  console.warn('⚠️  Validation passed with warnings.');
  process.exit(0);
} else {
  console.log('✅ All validation checks passed!');
  process.exit(0);
}
