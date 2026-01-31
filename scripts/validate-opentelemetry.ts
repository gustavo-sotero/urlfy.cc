#!/usr/bin/env bun
/**
 * OpenTelemetry Implementation Validator
 *
 * Validates that @elysiajs/opentelemetry is properly configured
 * and integrated with the Elysia router.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ValidationResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

const results: ValidationResult[] = [];

function validate(
  step: string,
  condition: boolean,
  message: string,
  details?: string
) {
  results.push({
    step,
    status: condition ? 'PASS' : 'FAIL',
    message,
    details
  });
}

function warn(step: string, message: string, details?: string) {
  results.push({
    step,
    status: 'WARN',
    message,
    details
  });
}

console.log('🔍 Validating @elysiajs/opentelemetry Implementation\n');

// Step 1: Check package.json
try {
  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')
  );

  const hasPackage = '@elysiajs/opentelemetry' in packageJson.dependencies;
  validate(
    'Step 1',
    hasPackage,
    'Package @elysiajs/opentelemetry installed',
    hasPackage
      ? `Version: ${packageJson.dependencies['@elysiajs/opentelemetry']}`
      : 'Not found in dependencies'
  );
} catch (error) {
  validate('Step 1', false, 'Failed to read package.json', String(error));
}

// Step 2: Check next.config.ts
try {
  const nextConfig = readFileSync(
    resolve(process.cwd(), 'next.config.ts'),
    'utf-8'
  );

  const hasServerExternal = nextConfig.includes("'@elysiajs/opentelemetry'");
  validate(
    'Step 2a',
    hasServerExternal,
    'Added to serverExternalPackages in next.config.ts',
    hasServerExternal ? 'Found in serverExternalPackages array' : 'Not found'
  );

  const hasOutputTracing =
    nextConfig.includes('./node_modules/@elysiajs/**/*') ||
    nextConfig.includes('./node_modules/@elysiajs/opentelemetry/**/*');
  validate(
    'Step 2b',
    hasOutputTracing,
    'Added to outputFileTracingIncludes in next.config.ts',
    hasOutputTracing
      ? 'Found in outputFileTracingIncludes (via @elysiajs/**/* glob)'
      : 'Not found'
  );
} catch (error) {
  validate('Step 2', false, 'Failed to read next.config.ts', String(error));
}

// Step 3: Check src/server/index.ts
try {
  const serverIndex = readFileSync(
    resolve(process.cwd(), 'src/server/index.ts'),
    'utf-8'
  );

  const hasImport = serverIndex.includes(
    "import { opentelemetry } from '@elysiajs/opentelemetry'"
  );
  validate(
    'Step 3a',
    hasImport,
    'Plugin imported in src/server/index.ts',
    hasImport ? 'Import statement found' : 'Import not found'
  );

  const hasRegistration = serverIndex.includes('.use(\n    opentelemetry(');
  validate(
    'Step 3b',
    hasRegistration,
    'Plugin registered in Elysia router',
    hasRegistration ? 'Plugin .use() call found' : 'Registration not found'
  );

  // Check if it's the first middleware in the main API instance
  // Match from "export const api" through the first .use() call including its content
  const apiBlockMatch = serverIndex.match(
    /export const api = new Elysia\(\{[^}]+\}\)[\s\S]{0,500}?\.use\(\s*opentelemetry/
  );
  const otelIsFirst = !!apiBlockMatch;

  if (otelIsFirst) {
    validate(
      'Step 3c',
      true,
      'Plugin registered as FIRST middleware (critical)',
      'OpenTelemetry is the first .use() call in main API router'
    );
  } else {
    warn(
      'Step 3c',
      'Plugin may not be first middleware',
      'OpenTelemetry should be registered before other middleware for complete lifecycle capture'
    );
  }
} catch (error) {
  validate(
    'Step 3',
    false,
    'Failed to read src/server/index.ts',
    String(error)
  );
}

// Step 4: Check for named handlers (sample check)
try {
  const publicController = readFileSync(
    resolve(
      process.cwd(),
      'src/server/modules/links/links-public.controller.ts'
    ),
    'utf-8'
  );

  const hasNamedFunctions = publicController.includes('async function');
  const hasAnonymousFunctions = publicController.match(/async \(\{/g);

  if (hasNamedFunctions) {
    validate(
      'Step 4',
      true,
      'Named function handlers detected',
      `Named functions will improve trace readability in SigNoz`
    );
  } else if (hasAnonymousFunctions) {
    warn(
      'Step 4',
      'Some handlers use anonymous functions',
      `${hasAnonymousFunctions.length} anonymous handlers found. Consider refactoring for better trace names.`
    );
  }
} catch (error) {
  warn('Step 4', 'Could not check handler naming patterns', String(error));
}

// Step 5: Check telemetry initialization
try {
  const telemetryLib = readFileSync(
    resolve(process.cwd(), 'src/server/lib/telemetry.ts'),
    'utf-8'
  );

  const hasOtelSdk = telemetryLib.includes('@opentelemetry/sdk-node');
  validate(
    'Step 5',
    hasOtelSdk,
    'Global OpenTelemetry SDK configured',
    hasOtelSdk
      ? 'SDK initialization found in src/server/lib/telemetry.ts'
      : 'SDK not found'
  );
} catch (error) {
  validate('Step 5', false, 'Failed to read telemetry.ts', String(error));
}

// Print results
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│              VALIDATION RESULTS                         │');
console.log('└─────────────────────────────────────────────────────────┘\n');

let passCount = 0;
let failCount = 0;
let warnCount = 0;

for (const result of results) {
  const icon =
    result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${result.step}] ${result.message}`);

  if (result.details) {
    console.log(`   └─ ${result.details}`);
  }
  console.log();

  if (result.status === 'PASS') passCount++;
  else if (result.status === 'WARN') warnCount++;
  else failCount++;
}

console.log('┌─────────────────────────────────────────────────────────┐');
console.log(
  `│ Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings${' '.repeat(Math.max(0, 20 - String(passCount).length - String(failCount).length - String(warnCount).length))} │`
);
console.log('└─────────────────────────────────────────────────────────┘\n');

if (failCount === 0 && warnCount === 0) {
  console.log('🎉 All checks passed! OpenTelemetry is properly configured.\n');
  console.log('Next steps:');
  console.log('  1. Start infrastructure: bun run docker:up:full');
  console.log('  2. Start application: bun dev');
  console.log('  3. Generate traces: curl http://localhost:3000/api/health');
  console.log('  4. View in SigNoz: http://localhost:3301\n');
  process.exit(0);
} else if (failCount === 0) {
  console.log('⚠️  Implementation complete with warnings. Review above.\n');
  process.exit(0);
} else {
  console.log('❌ Implementation incomplete. Fix failed checks above.\n');
  process.exit(1);
}
