#!/usr/bin/env bun

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
// In the monorepo, Elysia feature modules live in apps/api
const MODULES_ROOT = join(
  PROJECT_ROOT,
  'apps',
  'api',
  'src',
  'server',
  'modules'
);
const MODULE_IMPORT_PREFIX = '@/server/modules/';

const APP_SOURCE_DIRS = {
  web: join(PROJECT_ROOT, 'apps', 'web', 'src'),
  api: join(PROJECT_ROOT, 'apps', 'api', 'src'),
  worker: join(PROJECT_ROOT, 'apps', 'worker', 'src')
} as const;

type AppName = keyof typeof APP_SOURCE_DIRS;

// ── Cross-app boundary rules ──────────────────────────────────────────────────
// Maps each app source directory to the import patterns that are FORBIDDEN
// in its files. This enforces the monorepo contract: apps must not reach into
// another app's internal runtime code; they should only communicate via:
//   - published workspace packages  (packages/*)
//   - network boundaries between services (HTTP between web and api)
const APP_BOUNDARY_RULES: {
  appName: AppName;
  appDir: string;
  forbiddenAppDirs: string[];
  forbiddenPatterns: { pattern: RegExp; reason: string }[];
}[] = [
  {
    // apps/web must not import from other apps.
    appName: 'web',
    appDir: APP_SOURCE_DIRS.web,
    forbiddenAppDirs: [APP_SOURCE_DIRS.api, APP_SOURCE_DIRS.worker],
    forbiddenPatterns: [
      {
        pattern: /^@urlfy\/api\b/,
        reason:
          'apps/web must not import @urlfy/api. ' +
          'Use @urlfy/* shared packages and HTTP API boundaries instead.'
      },
      {
        pattern: /^worker\b/,
        reason:
          'apps/web must not import worker app internals. ' +
          'Use @urlfy/* shared packages instead.'
      },
      {
        pattern: /^apps\/(api|worker)\b/,
        reason:
          'apps/web must not import apps/api or apps/worker internals by path.'
      }
    ]
  },
  {
    // apps/api must not import from apps/web or apps/worker.
    appName: 'api',
    appDir: APP_SOURCE_DIRS.api,
    forbiddenAppDirs: [APP_SOURCE_DIRS.web, APP_SOURCE_DIRS.worker],
    forbiddenPatterns: [
      {
        pattern: /^web\b/,
        reason: 'apps/api must not import from apps/web.'
      },
      {
        pattern: /^worker\b/,
        reason: 'apps/api must not import from apps/worker.'
      },
      {
        pattern: /^apps\/(web|worker)\b/,
        reason:
          'apps/api must not import apps/web or apps/worker internals by path.'
      }
    ]
  },
  {
    // apps/worker must not import apps/web or apps/api code.
    appName: 'worker',
    appDir: APP_SOURCE_DIRS.worker,
    forbiddenAppDirs: [APP_SOURCE_DIRS.web, APP_SOURCE_DIRS.api],
    forbiddenPatterns: [
      {
        pattern: /^@urlfy\/api\b/,
        reason:
          'apps/worker must not import @urlfy/api. ' +
          'Use @urlfy/* shared packages instead.'
      },
      {
        pattern: /^web\b/,
        reason: 'apps/worker must not import from apps/web.'
      },
      {
        pattern: /^apps\/(web|api)\b/,
        reason:
          'apps/worker must not import apps/web or apps/api internals by path.'
      }
    ]
  }
];

// ── packages/* → apps boundary rules ─────────────────────────────────────────
// Shared packages must not depend on app-level code so they remain reusable
// across all services. The only scoped app package name is @urlfy/api.
const PACKAGE_FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^@urlfy\/api\b/,
    reason:
      'packages/* must not import @urlfy/api. ' +
      'Keep packages independent of app internals; expose shared functionality via @urlfy/* packages instead.'
  },
  {
    pattern: /^web\b/,
    reason: 'packages/* must not import from apps/web.'
  },
  {
    pattern: /^worker\b/,
    reason: 'packages/* must not import from apps/worker.'
  },
  {
    pattern: /^apps\/(web|api|worker)\b/,
    reason: 'packages/* must not import app internals via path aliases.'
  }
];

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/\/+$/g, '');
}

function isPathInside(path: string, parentDir: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedParent = normalizePath(parentDir);

  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(`${normalizedParent}/`)
  );
}

function findRelativeBoundaryViolation(
  filePath: string,
  importPath: string,
  forbiddenAppDirs: string[],
  currentAppName: AppName
): string | null {
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return null;
  }

  const resolvedImportPath = join(dirname(filePath), importPath);

  for (const forbiddenDir of forbiddenAppDirs) {
    if (!isPathInside(resolvedImportPath, forbiddenDir)) {
      continue;
    }

    const targetAppName =
      (Object.entries(APP_SOURCE_DIRS).find(
        ([, value]) => normalizePath(value) === normalizePath(forbiddenDir)
      )?.[0] as AppName | undefined) || 'unknown';

    return (
      `apps/${currentAppName} must not import files from apps/${targetAppName} ` +
      'through relative paths. Use @urlfy/* shared packages or service boundaries instead.'
    );
  }

  return null;
}

interface Violation {
  file: string;
  line: number;
  importPath: string;
  reason: string;
}

interface ImportReference {
  importPath: string;
  line: number;
}

function getLineFromIndex(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

function collectImportReferences(source: string): ImportReference[] {
  // Supports:
  // - static imports (including multiline)
  // - export ... from 'module'
  // - side-effect imports: import 'module'
  // - dynamic imports: import('module')
  const patterns = [
    /(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?[\w*\s{},]*\sfrom\s+['"]([^'"]+)['"]/gm,
    /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm
  ];

  const references: ImportReference[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    for (;;) {
      const match = pattern.exec(source);
      if (match === null) break;

      const importPath = match[1];
      if (!importPath) continue;

      const line = getLineFromIndex(source, match.index);
      const key = `${line}:${importPath}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      references.push({ importPath, line });
    }
  }

  return references;
}

async function getTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      files.push(...(await getTypeScriptFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (
      !fullPath.endsWith('.ts') &&
      !fullPath.endsWith('.tsx') &&
      !fullPath.endsWith('.mts') &&
      !fullPath.endsWith('.cts')
    ) {
      continue;
    }
    if (fullPath.endsWith('.d.ts')) continue;

    files.push(fullPath);
  }

  return files;
}

function getCurrentModuleName(filePath: string): string | null {
  const relPath = relative(MODULES_ROOT, filePath);
  if (!relPath || relPath.startsWith('..')) return null;

  const normalizedRelPath = normalizePath(relPath);
  if (!normalizedRelPath.includes('/')) {
    return null;
  }

  const [moduleName] = relPath.split(sep);
  return moduleName || null;
}

function isCrossModuleInternalImport(
  currentModule: string,
  importPath: string
): { valid: boolean; reason?: string } {
  if (!importPath.startsWith(MODULE_IMPORT_PREFIX)) {
    return { valid: true };
  }

  const targetPath = importPath.slice(MODULE_IMPORT_PREFIX.length);
  const segments = targetPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { valid: true };
  }

  const [targetModule] = segments;

  if (!targetModule) {
    return { valid: true };
  }

  if (targetModule === currentModule) {
    return { valid: true };
  }

  return {
    valid: false,
    reason:
      'Feature modules must not import sibling modules directly. Extract shared abstractions under src/server/services/ or packages/* instead.'
  };
}

// ── Cross-app boundary validator ─────────────────────────────────────────────

async function validateCrossAppBoundaries(): Promise<Violation[]> {
  const violations: Violation[] = [];

  for (const {
    appName,
    appDir,
    forbiddenAppDirs,
    forbiddenPatterns
  } of APP_BOUNDARY_RULES) {
    let files: string[];
    try {
      files = await getTypeScriptFiles(appDir);
    } catch {
      // Directory may not exist in partial setups — skip gracefully
      continue;
    }

    for (const filePath of files) {
      const source = await readFile(filePath, 'utf-8');
      const imports = collectImportReferences(source);

      for (const { importPath, line } of imports) {
        for (const { pattern, reason } of forbiddenPatterns) {
          if (pattern.test(importPath)) {
            violations.push({
              file: relative(PROJECT_ROOT, filePath).replaceAll('\\', '/'),
              line,
              importPath,
              reason
            });
            break; // one reason per import per line is enough
          }
        }

        const relativeViolation = findRelativeBoundaryViolation(
          filePath,
          importPath,
          forbiddenAppDirs,
          appName
        );

        if (relativeViolation) {
          violations.push({
            file: relative(PROJECT_ROOT, filePath).replaceAll('\\', '/'),
            line,
            importPath,
            reason: relativeViolation
          });
        }
      }
    }
  }

  // ── packages/* → apps boundary check ──────────────────────────────────────
  // Dynamically scan every package src/ to enforce the invariant that shared
  // packages never reach into app runtime code.
  const packagesRoot = join(PROJECT_ROOT, 'packages');
  let packageDirs: import('node:fs').Dirent[] = [];
  try {
    packageDirs = await readdir(packagesRoot, { withFileTypes: true });
  } catch {
    // packages/ directory not found — skip
  }

  for (const pkg of packageDirs) {
    if (!pkg.isDirectory()) continue;

    const srcDir = join(packagesRoot, pkg.name, 'src');
    let pkgFiles: string[];
    try {
      pkgFiles = await getTypeScriptFiles(srcDir);
    } catch {
      continue; // No src/ directory in this package (e.g. config-ts, config-biome)
    }

    for (const filePath of pkgFiles) {
      const source = await readFile(filePath, 'utf-8');
      const imports = collectImportReferences(source);

      for (const { importPath, line } of imports) {
        for (const { pattern, reason } of PACKAGE_FORBIDDEN_PATTERNS) {
          if (pattern.test(importPath)) {
            violations.push({
              file: relative(PROJECT_ROOT, filePath).replaceAll('\\', '/'),
              line,
              importPath,
              reason
            });
            break;
          }
        }
      }
    }
  }

  return violations;
}

// ── Intra-API module boundary validator ──────────────────────────────────────

async function validateBoundaries(): Promise<void> {
  console.log('🔍 Validating module import boundaries...\n');

  const files = await getTypeScriptFiles(MODULES_ROOT);
  const violations: Violation[] = [];

  for (const filePath of files) {
    const currentModule = getCurrentModuleName(filePath);
    if (!currentModule) continue;

    const source = await readFile(filePath, 'utf-8');
    const imports = collectImportReferences(source);

    for (const { importPath, line } of imports) {
      const result = isCrossModuleInternalImport(currentModule, importPath);
      if (!result.valid) {
        violations.push({
          file: relative(PROJECT_ROOT, filePath).replaceAll('\\', '/'),
          line,
          importPath,
          reason: result.reason || 'Invalid cross-module import'
        });
      }
    }
  }

  // ── Cross-app boundary check ────────────────────────────────────
  const crossAppViolations = await validateCrossAppBoundaries();
  violations.push(...crossAppViolations);

  if (violations.length === 0) {
    console.log('✅ No module boundary violations found\n');
    return;
  }

  console.log(`❌ Found ${violations.length} module boundary violation(s):\n`);

  for (const violation of violations) {
    console.log(`${violation.file}:${violation.line}`);
    console.log(`  import: ${violation.importPath}`);
    console.log(`  reason: ${violation.reason}\n`);
  }

  process.exit(1);
}

validateBoundaries().catch((error) => {
  console.error('Unexpected error while validating module boundaries:', error);
  process.exit(1);
});
