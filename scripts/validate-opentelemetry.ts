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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLockfileVersion(
  lockText: string,
  lockKey: string,
  resolvedPackageName: string
): string | undefined {
  const match = lockText.match(
    new RegExp(
      `"${escapeRegExp(lockKey)}": \\["${escapeRegExp(resolvedPackageName)}@([^"]+)"`
    )
  );

  return match?.[1];
}

function findNestedLockfileVersions(
  lockText: string,
  prefix: string,
  resolvedPackageName: string
): string[] {
  const regex = new RegExp(
    `"${escapeRegExp(prefix + resolvedPackageName)}": \\["${escapeRegExp(resolvedPackageName)}@([^"]+)"`,
    'g'
  );
  const versions = new Set<string>();

  for (const match of lockText.matchAll(regex)) {
    if (match[1]) versions.add(match[1]);
  }

  return [...versions];
}

console.log('🔍 Validating OpenTelemetry / LogTape implementation\n');

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

// Step 2: Check apps/api/package.json (monorepo: @elysiajs/opentelemetry belongs
// to the API service only, not to apps/web which uses standard @opentelemetry/*)
try {
  const apiPackageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), 'apps/api/package.json'), 'utf-8')
  );

  const hasApiDep =
    '@elysiajs/opentelemetry' in (apiPackageJson.dependencies ?? {});
  validate(
    'Step 2a',
    hasApiDep,
    '@elysiajs/opentelemetry in apps/api/package.json dependencies',
    hasApiDep
      ? `Version: ${apiPackageJson.dependencies?.['@elysiajs/opentelemetry']}`
      : 'Not found in apps/api dependencies (package only needed by Elysia server, not Next.js)'
  );

  // apps/web/next.config.ts should include the standard @opentelemetry packages
  // (NOT @elysiajs/opentelemetry which is only used by apps/api Elysia server)
  const nextConfig = readFileSync(
    resolve(process.cwd(), 'apps/web/next.config.ts'),
    'utf-8'
  );
  const hasWebOtelPackages =
    nextConfig.includes("'@opentelemetry/api'") ||
    nextConfig.includes("'@opentelemetry/sdk-node'");
  validate(
    'Step 2b',
    hasWebOtelPackages,
    'Standard @opentelemetry/* packages in apps/web serverExternalPackages',
    hasWebOtelPackages
      ? 'Found @opentelemetry/* packages in serverExternalPackages (correct: Elysia plugin is API-only)'
      : 'Standard OTel packages missing from next.config.ts serverExternalPackages'
  );
} catch (error) {
  validate('Step 2', false, 'Failed to read API/web config', String(error));
}

// Step 3: Check src/server/index.ts
try {
  const serverIndex = readFileSync(
    resolve(process.cwd(), 'apps/api/src/server/index.ts'),
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
    'Failed to read apps/api/src/server/index.ts',
    String(error)
  );
}

// Step 4: Check for named handlers (sample check)
try {
  const publicController = readFileSync(
    resolve(
      process.cwd(),
      'apps/api/src/server/modules/links/links-public.controller.ts'
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
      'Named functions will improve trace readability in the observability backend'
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
  const apiTelemetryShim = readFileSync(
    resolve(process.cwd(), 'apps/api/src/server/lib/telemetry.ts'),
    'utf-8'
  );
  const telemetryInit = readFileSync(
    resolve(process.cwd(), 'packages/telemetry/src/init.ts'),
    'utf-8'
  );

  const hasCanonicalReexport = apiTelemetryShim.includes(
    "export * from '@urlfy/telemetry'"
  );
  validate(
    'Step 5a',
    hasCanonicalReexport,
    'API telemetry shim re-exports canonical package',
    hasCanonicalReexport
      ? 'apps/api now points to @urlfy/telemetry as the single source'
      : 'apps/api telemetry shim is not re-exporting @urlfy/telemetry'
  );

  const hasOtelSdk = telemetryInit.includes('@opentelemetry/sdk-node');
  validate(
    'Step 5b',
    hasOtelSdk,
    'Global OpenTelemetry SDK configured',
    hasOtelSdk
      ? 'SDK initialization found in packages/telemetry/src/init.ts'
      : 'SDK not found'
  );
} catch (error) {
  validate('Step 5', false, 'Failed to read telemetry files', String(error));
}

// Step 6: Check LogTape packages
try {
  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')
  );

  const hasLogTape = '@logtape/logtape' in packageJson.dependencies;
  const hasLogTapeOtel = '@logtape/otel' in packageJson.dependencies;
  const hasLogTapeElysia = '@logtape/elysia' in packageJson.dependencies;
  const hasLogTapeDrizzle = '@logtape/drizzle-orm' in packageJson.dependencies;
  const hasLogTapeRedaction = '@logtape/redaction' in packageJson.dependencies;

  validate(
    'Step 6a',
    hasLogTape,
    '@logtape/logtape installed',
    hasLogTape
      ? `Version: ${packageJson.dependencies['@logtape/logtape']}`
      : 'Not found in dependencies'
  );
  validate(
    'Step 6b',
    hasLogTapeOtel,
    '@logtape/otel installed',
    hasLogTapeOtel
      ? `Version: ${packageJson.dependencies['@logtape/otel']}`
      : 'Not found in dependencies'
  );
  validate(
    'Step 6c',
    hasLogTapeElysia,
    '@logtape/elysia installed',
    hasLogTapeElysia
      ? `Version: ${packageJson.dependencies['@logtape/elysia']}`
      : 'Not found in dependencies'
  );
  validate(
    'Step 6d',
    hasLogTapeDrizzle,
    '@logtape/drizzle-orm installed',
    hasLogTapeDrizzle
      ? `Version: ${packageJson.dependencies['@logtape/drizzle-orm']}`
      : 'Not found in dependencies'
  );
  validate(
    'Step 6e',
    hasLogTapeRedaction,
    '@logtape/redaction installed',
    hasLogTapeRedaction
      ? `Version: ${packageJson.dependencies['@logtape/redaction']}`
      : 'Not found in dependencies'
  );
} catch (error) {
  validate('Step 6', false, 'Failed to check LogTape packages', String(error));
}

// Step 7: Check LogTape configuration in canonical init.ts
try {
  const initTs = readFileSync(
    resolve(process.cwd(), 'packages/telemetry/src/init.ts'),
    'utf-8'
  );

  validate(
    'Step 7a',
    initTs.includes('configureLogging'),
    'configureLogging() function exists in init.ts',
    initTs.includes('configureLogging')
      ? 'Function found'
      : 'Function not found'
  );
  validate(
    'Step 7b',
    initTs.includes('getOpenTelemetrySink'),
    'LogTape OTel sink configured',
    initTs.includes('getOpenTelemetrySink')
      ? 'getOpenTelemetrySink() call found'
      : 'Not found'
  );
  validate(
    'Step 7c',
    initTs.includes('redactByField'),
    'Field-based redaction configured',
    initTs.includes('redactByField')
      ? 'redactByField() call found'
      : 'Not found'
  );
} catch (error) {
  validate('Step 7', false, 'Failed to check LogTape config', String(error));
}

// Step 8: Check Elysia request logging via @logtape/elysia
try {
  const serverIndex = readFileSync(
    resolve(process.cwd(), 'apps/api/src/server/index.ts'),
    'utf-8'
  );

  validate(
    'Step 8',
    serverIndex.includes('elysiaLogger'),
    'Elysia request logging via @logtape/elysia',
    serverIndex.includes('elysiaLogger')
      ? 'elysiaLogger() middleware found'
      : 'Not found'
  );
} catch (error) {
  validate('Step 8', false, 'Failed to check Elysia logging', String(error));
}

// Step 9: Check Drizzle ORM query logging
try {
  const dbIndex = readFileSync(
    resolve(process.cwd(), 'packages/data/src/index.ts'),
    'utf-8'
  );

  validate(
    'Step 9',
    dbIndex.includes('getDrizzleLogger'),
    'Drizzle ORM query logging via @logtape/drizzle-orm',
    dbIndex.includes('getDrizzleLogger')
      ? 'getDrizzleLogger() call found in packages/data/src/index.ts'
      : 'Not found'
  );
} catch (error) {
  validate('Step 9', false, 'Failed to check Drizzle logging', String(error));
}

// Step 10: Check for OTel / LogTape version skew between telemetry package and root.
// The shared telemetry package must declare the same runtime family as the root
// to prevent split observability paths for logs.
try {
  const rootPkg = JSON.parse(
    readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')
  );
  const telemetryPkg = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'packages/telemetry/package.json'),
      'utf-8'
    )
  );

  const observabilityPackages = [
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/semantic-conventions',
    '@logtape/logtape',
    '@logtape/otel',
    '@logtape/redaction'
  ];

  const skewedPackages: string[] = [];

  for (const pkg of observabilityPackages) {
    const rootVersion: string | undefined =
      rootPkg.dependencies?.[pkg] ?? rootPkg.devDependencies?.[pkg];
    const telemetryVersion: string | undefined =
      telemetryPkg.dependencies?.[pkg] ?? telemetryPkg.devDependencies?.[pkg];

    if (!rootVersion || !telemetryVersion) continue;

    // Extract the semver range prefix (e.g. "^0.213.0" → "0.213")
    const rootMinor = rootVersion
      .replace(/[\^~>=<]/g, '')
      .split('.')
      .slice(0, 2)
      .join('.');
    const telemetryMinor = telemetryVersion
      .replace(/[\^~>=<]/g, '')
      .split('.')
      .slice(0, 2)
      .join('.');

    if (rootMinor !== telemetryMinor) {
      skewedPackages.push(
        `${pkg}: root=${rootVersion}, telemetry=${telemetryVersion}`
      );
    }
  }

  if (skewedPackages.length === 0) {
    validate(
      'Step 10',
      true,
      'No OTel / LogTape version skew between root and packages/telemetry',
      'Root and telemetry package declare the same observability minor families'
    );
  } else {
    validate(
      'Step 10',
      false,
      'OTel / LogTape version skew detected between root and packages/telemetry',
      `Skewed packages (creates split runtime families, especially risky for logs):\n     ${skewedPackages.join('\n     ')}\n     Fix: align packages/telemetry dependencies to match root package.json versions.`
    );
  }
} catch (error) {
  validate(
    'Step 10',
    false,
    'Failed to check OTel / LogTape version skew',
    String(error)
  );
}

// Step 11: Ensure the shared telemetry package does not resolve its own nested OTel family.
// If bun.lock contains @urlfy/telemetry/@opentelemetry/* entries for the logging path,
// the shared provider/exporter path is split and can behave differently from the root runtime.
try {
  const lockText = readFileSync(resolve(process.cwd(), 'bun.lock'), 'utf-8');
  const criticalPackages = [
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/exporter-logs-otlp-http'
  ];

  const nestedTelemetryPackages: string[] = [];

  for (const pkg of criticalPackages) {
    const rootVersion = findLockfileVersion(lockText, pkg, pkg);
    const nestedVersions = findNestedLockfileVersions(
      lockText,
      '@urlfy/telemetry/',
      pkg
    );

    for (const version of nestedVersions) {
      nestedTelemetryPackages.push(
        `${pkg}: nested=${version}, root=${rootVersion ?? 'missing'}`
      );
    }
  }

  if (nestedTelemetryPackages.length === 0) {
    validate(
      'Step 11',
      true,
      'Shared telemetry path resolves root OTel packages directly',
      'bun.lock contains no nested @urlfy/telemetry OTel logging-path packages'
    );
  } else {
    validate(
      'Step 11',
      false,
      'Shared telemetry path resolves nested OTel packages',
      `Nested packages found under @urlfy/telemetry:\n     ${nestedTelemetryPackages.join('\n     ')}\n     Fix: dedupe the shared telemetry package onto the root OTel family.`
    );
  }
} catch (error) {
  validate(
    'Step 11',
    false,
    'Failed to inspect bun.lock for shared telemetry path',
    String(error)
  );
}

// Step 12: Nested OTel families inside adapters/plugins are acceptable only if the
// shared logging path is explicitly isolated from them.
try {
  const lockText = readFileSync(resolve(process.cwd(), 'bun.lock'), 'utf-8');
  const initTs = readFileSync(
    resolve(process.cwd(), 'packages/telemetry/src/init.ts'),
    'utf-8'
  );
  const criticalPackages = [
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/exporter-logs-otlp-http'
  ];

  const usesExplicitLoggerProvider =
    initTs.includes('getOpenTelemetrySink({') &&
    initTs.includes('loggerProvider,');

  const logtapeVersions = new Set<string>();
  const elysiaVersions = new Set<string>();

  for (const pkg of criticalPackages) {
    for (const version of findNestedLockfileVersions(
      lockText,
      '@logtape/otel/',
      pkg
    )) {
      logtapeVersions.add(version);
    }

    for (const version of findNestedLockfileVersions(
      lockText,
      '@elysiajs/opentelemetry/',
      pkg
    )) {
      elysiaVersions.add(version);
    }
  }

  if (logtapeVersions.size > 0 && !usesExplicitLoggerProvider) {
    validate(
      'Step 12',
      false,
      'Nested @logtape/otel OTel family is not isolated',
      `@logtape/otel resolves OTel versions ${[...logtapeVersions].join(', ')}, but packages/telemetry does not pass an explicit loggerProvider to getOpenTelemetrySink().`
    );
  } else {
    validate(
      'Step 12',
      true,
      'Nested adapter/plugin OTel families are isolated from the shared logging path',
      `@logtape/otel=${[...logtapeVersions].join(', ') || 'none'} (isolated via explicit loggerProvider), @elysiajs/opentelemetry=${[...elysiaVersions].join(', ') || 'none'} (API tracing plugin only)`
    );
  }
} catch (error) {
  validate(
    'Step 12',
    false,
    'Failed to verify nested adapter/plugin isolation',
    String(error)
  );
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
  console.log('  1. Start infrastructure: bun run docker:up');
  console.log('  2. Start application: bun dev');
  console.log('  3. Generate traces: curl http://localhost:3000/api/health');
  console.log(
    '  4. View telemetry in Grafana (self-hosted LGTM) or your OTLP backend\n'
  );
  process.exit(0);
} else if (failCount === 0) {
  console.log('⚠️  Implementation complete with warnings. Review above.\n');
  process.exit(0);
} else {
  console.log('❌ Implementation incomplete. Fix failed checks above.\n');
  process.exit(1);
}
