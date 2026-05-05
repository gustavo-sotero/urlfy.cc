import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const integrationDir = join(appDir, 'tests', 'integration');
const authMiddlewareTest =
  'src/server/middleware/__tests__/auth.middleware.test.ts';

function normalizeTarget(target: string): string {
  if (target.startsWith('tests/') || target.startsWith('src/')) {
    return target;
  }

  return join('tests', 'integration', target);
}

function getDefaultIntegrationFiles(): string[] {
  return readdirSync(integrationDir)
    .filter((entry) => entry.endsWith('.ts'))
    .sort()
    .map((entry) => join('tests', 'integration', entry));
}

function runTestFile(filePath: string): void {
  const env = { ...process.env };

  if (filePath === authMiddlewareTest) {
    env.RUN_AUTH_MIDDLEWARE_INFRA_TESTS = 'true';
  }

  process.stdout.write(`\n==> ${filePath}\n`);

  const result = Bun.spawnSync({
    cmd: [process.execPath, 'test', filePath],
    cwd: appDir,
    env,
    stdout: 'inherit',
    stderr: 'inherit'
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
}

const requestedTargets = Bun.argv.slice(2).map(normalizeTarget);
const integrationFiles =
  requestedTargets.length > 0 ? requestedTargets : getDefaultIntegrationFiles();

for (const filePath of integrationFiles) {
  runTestFile(filePath);
}

if (requestedTargets.length === 0) {
  runTestFile(authMiddlewareTest);
}
