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

  // Ensure .next/standalone exists
  if (!existsSync(standaloneDir)) {
    console.error(
      'Error: .next/standalone does not exist. Build might have failed or not in standalone mode.'
    );
    process.exit(1);
  }

  // 1. Copy public -> .next/standalone/public
  const publicSrc = join(cwd, 'public');
  const publicDest = join(standaloneDir, 'public');
  if (existsSync(publicSrc)) {
    await copyDir(publicSrc, publicDest);
  } else {
    console.warn('Warning: public folder not found.');
  }

  // 2. Copy .next/static -> .next/standalone/.next/static
  const staticSrc = join(cwd, '.next', 'static');
  // .next/static needs to go into .next/standalone/.next/static
  const staticDest = join(standaloneNextDir, 'static');

  // Ensure destination .next exists inside standalone if not created by Next.js
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
