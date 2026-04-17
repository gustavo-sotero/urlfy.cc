import { existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const cwd = process.cwd();

async function copyDir(src: string, dest: string) {
  try {
    await cp(src, dest, { recursive: true, force: true });
    console.log(`Checked: ${src} -> ${dest}`);
  } catch (err) {
    console.error(`Error copying ${src} to ${dest}:`, err);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting post-build copy...');

  const standaloneDir = join(cwd, '.next', 'standalone');
  const standaloneNextDir = join(standaloneDir, '.next');

  if (!existsSync(standaloneDir)) {
    console.error(
      'Error: .next/standalone does not exist. Build might have failed or not in standalone mode.'
    );
    process.exit(1);
  }

  const publicSrc = join(cwd, 'public');
  const publicDest = join(standaloneDir, 'public');
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
