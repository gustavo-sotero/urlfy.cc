#!/usr/bin/env bun

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const WORKSPACE_ROOTS = ['apps', 'packages'] as const;
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const;

type DependencyMap = Record<string, string>;

interface WorkspacesConfig {
  packages?: string[];
  catalog?: DependencyMap;
  catalogs?: Record<string, DependencyMap>;
}

interface PackageJson {
  name?: string;
  workspaces?: string[] | WorkspacesConfig;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
}

interface CatalogEntry {
  protocol: string;
  version: string;
  source: string;
}

interface Violation {
  file: string;
  message: string;
}

async function readPackageJson(filePath: string): Promise<PackageJson> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as PackageJson;
}

function toRelativePath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath).replaceAll('\\', '/');
}

function buildCatalogEntries(
  workspaces: WorkspacesConfig
): Map<string, CatalogEntry> {
  const entries = new Map<string, CatalogEntry>();

  for (const [name, version] of Object.entries(workspaces.catalog ?? {})) {
    entries.set(name, {
      protocol: 'catalog:',
      version,
      source: 'workspaces.catalog'
    });
  }

  for (const [catalogName, catalog] of Object.entries(
    workspaces.catalogs ?? {}
  )) {
    for (const [name, version] of Object.entries(catalog)) {
      const existing = entries.get(name);
      if (existing) {
        throw new Error(
          `Dependency "${name}" is declared in multiple catalogs (${existing.source} and workspaces.catalogs.${catalogName}).`
        );
      }

      entries.set(name, {
        protocol: `catalog:${catalogName}`,
        version,
        source: `workspaces.catalogs.${catalogName}`
      });
    }
  }

  return entries;
}

async function getWorkspaceManifestPaths(): Promise<string[]> {
  const manifests: string[] = [];

  for (const root of WORKSPACE_ROOTS) {
    const rootPath = join(PROJECT_ROOT, root);
    const entries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      manifests.push(join(rootPath, entry.name, 'package.json'));
    }
  }

  return manifests.sort();
}

function collectRootViolations(
  rootPkg: PackageJson,
  catalogEntries: Map<string, CatalogEntry>
): Violation[] {
  const violations: Violation[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = rootPkg[section];
    if (!dependencies) {
      continue;
    }

    for (const [name, spec] of Object.entries(dependencies)) {
      const catalogEntry = catalogEntries.get(name);
      if (!catalogEntry) {
        continue;
      }

      if (spec !== catalogEntry.version) {
        violations.push({
          file: 'package.json',
          message:
            `root ${section}.${name} must stay aligned with ${catalogEntry.source}: ` +
            `expected "${catalogEntry.version}", found "${spec}".`
        });
      }
    }
  }

  return violations;
}

function collectWorkspaceViolations(
  manifestPath: string,
  pkg: PackageJson,
  catalogEntries: Map<string, CatalogEntry>
): Violation[] {
  const violations: Violation[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = pkg[section];
    if (!dependencies) {
      continue;
    }

    for (const [name, spec] of Object.entries(dependencies)) {
      const catalogEntry = catalogEntries.get(name);
      if (!catalogEntry) {
        continue;
      }

      if (spec !== catalogEntry.protocol) {
        violations.push({
          file: toRelativePath(manifestPath),
          message:
            `${section}.${name} must use "${catalogEntry.protocol}" ` +
            `(resolved by ${catalogEntry.source}), found "${spec}".`
        });
      }
    }
  }

  return violations;
}

async function main() {
  const rootPackagePath = join(PROJECT_ROOT, 'package.json');
  const rootPkg = await readPackageJson(rootPackagePath);

  if (!rootPkg.workspaces || Array.isArray(rootPkg.workspaces)) {
    throw new Error(
      'Root package.json must use the object form of "workspaces" to define catalogs.'
    );
  }

  const catalogEntries = buildCatalogEntries(rootPkg.workspaces);
  if (catalogEntries.size === 0) {
    throw new Error(
      'No catalog-managed dependencies were found in root package.json.'
    );
  }

  const violations = collectRootViolations(rootPkg, catalogEntries);
  const workspaceManifests = await getWorkspaceManifestPaths();

  for (const manifestPath of workspaceManifests) {
    const pkg = await readPackageJson(manifestPath);
    violations.push(
      ...collectWorkspaceViolations(manifestPath, pkg, catalogEntries)
    );
  }

  if (violations.length > 0) {
    console.error('Catalog validation failed:');
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log(
    `Catalog validation passed for ${workspaceManifests.length} workspace manifests and ${catalogEntries.size} managed packages.`
  );
}

main().catch((error) => {
  console.error(
    `Catalog validation failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
