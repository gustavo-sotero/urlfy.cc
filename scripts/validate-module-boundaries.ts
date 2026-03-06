#!/usr/bin/env bun

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

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

interface Violation {
  file: string;
  line: number;
  importPath: string;
  reason: string;
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
    if (!fullPath.endsWith('.ts')) continue;

    files.push(fullPath);
  }

  return files;
}

function getCurrentModuleName(filePath: string): string | null {
  const relPath = relative(MODULES_ROOT, filePath);
  if (!relPath || relPath.startsWith('..')) return null;

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

  const [targetModule, secondSegment] = segments;

  if (!targetModule) {
    return { valid: true };
  }

  if (targetModule === currentModule) {
    return { valid: true };
  }

  if (!secondSegment) {
    return { valid: true };
  }

  if (segments.length === 2 && secondSegment === 'index') {
    return { valid: true };
  }

  return {
    valid: false,
    reason:
      'Cross-module imports must use module barrel exports only (e.g. "@/server/modules/<module>")'
  };
}

async function validateBoundaries(): Promise<void> {
  console.log('🔍 Validating module import boundaries...\n');

  const files = await getTypeScriptFiles(MODULES_ROOT);
  const violations: Violation[] = [];

  const importRegex =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]/g;

  for (const filePath of files) {
    const currentModule = getCurrentModuleName(filePath);
    if (!currentModule) continue;

    const source = await readFile(filePath, 'utf-8');
    const lines = source.split('\n');

    for (const [index, line] of lines.entries()) {
      importRegex.lastIndex = 0;

      for (;;) {
        const match = importRegex.exec(line);
        if (match === null) {
          break;
        }

        const importPath = match[1];
        if (!importPath) continue;

        const result = isCrossModuleInternalImport(currentModule, importPath);
        if (!result.valid) {
          violations.push({
            file: relative(PROJECT_ROOT, filePath).replaceAll('\\', '/'),
            line: index + 1,
            importPath,
            reason: result.reason || 'Invalid cross-module import'
          });
        }
      }
    }
  }

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
