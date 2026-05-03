import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const cwd = process.cwd();

function findWorkspaceRoot(startDir: string) {
  let currentDir = resolve(startDir);

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json');

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      if (packageJson.workspaces) {
        return currentDir;
      }
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

function getStandaloneAppDir(standaloneDir: string) {
  const flatServerPath = join(standaloneDir, 'server.js');

  if (existsSync(flatServerPath)) {
    return standaloneDir;
  }

  const workspaceRoot = findWorkspaceRoot(cwd);
  const appRelativeDir = relative(workspaceRoot, cwd);
  const nestedAppDir = join(standaloneDir, appRelativeDir);
  const nestedServerPath = join(nestedAppDir, 'server.js');

  if (existsSync(nestedServerPath)) {
    return nestedAppDir;
  }

  console.error(
    `Error: standalone server.js not found at ${flatServerPath} or ${nestedServerPath}.`
  );
  process.exit(1);
}

async function copyDir(src: string, dest: string) {
  try {
    await cp(src, dest, { recursive: true, force: true });
    console.log(`Checked: ${src} -> ${dest}`);
  } catch (error) {
    console.error(`Error copying ${src} to ${dest}:`, error);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting post-build copy...');

  const standaloneDir = join(cwd, '.next', 'standalone');

  if (!existsSync(standaloneDir)) {
    console.error(
      'Error: .next/standalone does not exist. Build might have failed or not in standalone mode.'
    );
    process.exit(1);
  }

  const standaloneAppDir = getStandaloneAppDir(standaloneDir);
  const standaloneNextDir = join(standaloneAppDir, '.next');

  const publicSrc = join(cwd, 'public');
  const publicDest = join(standaloneAppDir, 'public');
  if (existsSync(publicSrc)) {
    await copyDir(publicSrc, publicDest);
  } else {
    console.log('Skipped optional public copy: no public folder found.');
  }

  const staticSrc = join(cwd, '.next', 'static');
  const staticDest = join(standaloneNextDir, 'static');

  if (!existsSync(standaloneNextDir)) {
    await mkdir(standaloneNextDir, { recursive: true });
  }

  if (existsSync(staticSrc)) {
    await copyDir(staticSrc, staticDest);
  } else {
    console.warn('Warning: .next/static folder not found.');
  }

  console.log('Post-build copy completed successfully.');
}

main();
