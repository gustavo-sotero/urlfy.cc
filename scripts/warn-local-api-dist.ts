import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '..');
const distEntry = resolve(workspaceRoot, 'apps/api/dist/index.js');

if (!existsSync(distEntry)) {
  process.exit(0);
}

const displayPath = relative(workspaceRoot, distEntry).replace(/\\/g, '/');

console.warn(
  `[dev-preflight] Warning: ${displayPath} exists. Local development runs the API from src/, and stale dist/ artifacts have previously masked the live process on :3001. If you are not testing the Docker/production build, remove apps/api/dist or rebuild before starting any dist-based process.`
);
