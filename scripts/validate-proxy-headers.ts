#!/usr/bin/env bun

/**
 * Semantic guardrail: prevents runtime code from parsing proxy headers
 * (x-forwarded-for, x-real-ip, etc.) directly. All IP derivation must go
 * through the canonical helpers in @urlfy/telemetry.
 *
 * Usage: bun run scripts/validate-proxy-headers.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');

// ── Directories to scan (runtime source only) ────────────────────────────────
const SCAN_DIRS = [
  join(PROJECT_ROOT, 'apps', 'api', 'src'),
  join(PROJECT_ROOT, 'apps', 'web', 'src'),
  join(PROJECT_ROOT, 'apps', 'worker', 'src'),
  join(PROJECT_ROOT, 'packages')
];

// ── Approved helper files that may parse proxy headers ───────────────────────
const APPROVED_FILES = new Set([
  'packages/telemetry/src/ip.ts',
  // API gateway sets x-forwarded-for using canonical getClientIp() when proxying
  'apps/web/src/app/api/[[...slugs]]/route.ts'
]);

// ── Patterns that indicate direct proxy-header parsing ───────────────────────
const PROXY_HEADER_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /['"`]x-forwarded-for['"`]/i,
    description: 'Direct access to x-forwarded-for header'
  },
  {
    pattern: /['"`]x-real-ip['"`]/i,
    description: 'Direct access to x-real-ip header'
  },
  {
    pattern: /['"`]x-client-ip['"`]/i,
    description: 'Direct access to x-client-ip header'
  },
  {
    pattern: /['"`]cf-connecting-ip['"`]/i,
    description: 'Direct access to cf-connecting-ip header'
  },
  {
    pattern: /['"`]true-client-ip['"`]/i,
    description: 'Direct access to true-client-ip header'
  }
];

interface Violation {
  file: string;
  line: number;
  text: string;
  description: string;
}

async function getTypeScriptFiles(dir: string): Promise<string[]> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '__tests__' ||
        entry.name === 'tests'
      )
        continue;
      files.push(...(await getTypeScriptFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (
      !fullPath.endsWith('.ts') &&
      !fullPath.endsWith('.tsx') &&
      !fullPath.endsWith('.mts')
    ) {
      continue;
    }
    if (fullPath.endsWith('.d.ts')) continue;

    files.push(fullPath);
  }

  return files;
}

async function scan(): Promise<void> {
  console.log('🔍 Scanning for direct proxy-header parsing...\n');

  const violations: Violation[] = [];

  for (const scanDir of SCAN_DIRS) {
    const files = await getTypeScriptFiles(scanDir);

    for (const filePath of files) {
      const relPath = relative(PROJECT_ROOT, filePath).replaceAll('\\', '/');

      if (APPROVED_FILES.has(relPath)) continue;

      const source = await readFile(filePath, 'utf-8');
      const lines = source.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment-only lines
        if (
          line.trimStart().startsWith('//') ||
          line.trimStart().startsWith('*')
        )
          continue;

        for (const { pattern, description } of PROXY_HEADER_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: relPath,
              line: i + 1,
              text: line.trim(),
              description
            });
          }
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ No direct proxy-header parsing found in runtime code\n');
    console.log(`   Approved helper(s): ${[...APPROVED_FILES].join(', ')}`);
    return;
  }

  console.log(
    `❌ Found ${violations.length} direct proxy-header access(es):\n`
  );
  console.log(
    '   All IP derivation must go through @urlfy/telemetry (getClientIp / getClientIpFromHeaders).\n'
  );

  for (const v of violations) {
    console.log(`${v.file}:${v.line}`);
    console.log(`  ${v.description}`);
    console.log(`  ${v.text}\n`);
  }

  console.log(`Approved helper file(s): ${[...APPROVED_FILES].join(', ')}`);
  process.exit(1);
}

scan().catch((error) => {
  console.error('Unexpected error while scanning proxy headers:', error);
  process.exit(1);
});
