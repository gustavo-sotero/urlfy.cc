#!/usr/bin/env bun

import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const API_URL = 'http://127.0.0.1:3001';
const WEB_URL = 'http://127.0.0.1:3000';
const bunBinary = process.execPath;

function spawnProcess(
  label: string,
  cmd: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Bun.Subprocess {
  console.log(`▶ Starting ${label}: ${cmd.join(' ')}`);
  return Bun.spawn(cmd, {
    cwd,
    env,
    stdout: 'inherit',
    stderr: 'inherit'
  });
}

function ensureStillRunning(process: Bun.Subprocess, label: string): void {
  if (process.exitCode !== null) {
    throw new Error(`${label} exited early with code ${process.exitCode}`);
  }
}

async function waitForUrlfyHealth(
  baseUrl: string,
  processes: Array<{ label: string; process: Bun.Subprocess }>
): Promise<void> {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    for (const entry of processes) {
      ensureStillRunning(entry.process, entry.label);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2_000)
      });

      if (response.ok) {
        const requestId = response.headers.get('x-request-id');
        const contentType = response.headers.get('content-type') || '';

        if (requestId && contentType.includes('application/json')) {
          const body = await response.json().catch(() => null);
          if (body?.status === 'ok') {
            console.log(`✅ urlfy health check is live at ${baseUrl}`);
            return;
          }
        }
      }
    } catch {
      // keep polling until timeout
    }

    await Bun.sleep(1_000);
  }

  throw new Error(`Timed out waiting for urlfy health at ${baseUrl}`);
}

async function warmWebRoute(
  baseUrl: string,
  routePath: string,
  processes: Array<{ label: string; process: Bun.Subprocess }>
): Promise<void> {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    for (const entry of processes) {
      ensureStillRunning(entry.process, entry.label);
    }

    try {
      const response = await fetch(`${baseUrl}${routePath}`, {
        signal: AbortSignal.timeout(10_000)
      });

      if (response.ok || response.redirected) {
        await response.text().catch(() => null);
        console.log(`✅ Warmed web route at ${baseUrl}${routePath}`);
        return;
      }
    } catch {
      // keep polling until timeout
    }

    await Bun.sleep(1_000);
  }

  throw new Error(`Timed out warming web route at ${baseUrl}${routePath}`);
}

async function main(): Promise<void> {
  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    API_PORT: '3001',
    TRUST_PROXY: 'true',
    ADMIN_GITHUB_ACCOUNT_ID:
      process.env.ADMIN_GITHUB_ACCOUNT_ID || 'test-admin-github-account'
  };
  const webEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3000',
    DEV_API_PROXY_TARGET: API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || WEB_URL
  };

  const apiProcess = spawnProcess(
    'API server',
    [bunBinary, '--env-file=.env', 'run', 'apps/api/src/index.ts'],
    PROJECT_ROOT,
    apiEnv
  );
  const webProcess = spawnProcess(
    'web server',
    [
      bunBinary,
      '--env-file=../../.env',
      '--bun',
      'next',
      'dev',
      '--port',
      '3000'
    ],
    join(PROJECT_ROOT, 'apps', 'web'),
    webEnv
  );

  try {
    ensureStillRunning(apiProcess, 'API server');
    ensureStillRunning(webProcess, 'web server');
    await waitForUrlfyHealth(WEB_URL, [
      { label: 'API server', process: apiProcess },
      { label: 'web server', process: webProcess }
    ]);
    await warmWebRoute(WEB_URL, '/', [
      { label: 'API server', process: apiProcess },
      { label: 'web server', process: webProcess }
    ]);

    const testProcess = Bun.spawn(
      [
        bunBinary,
        'test',
        'apps/web/tests/security/integration.test.ts',
        'apps/web/tests/security/headers.test.ts'
      ],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          TEST_BASE_URL: WEB_URL,
          TEST_API_BASE_URL: API_URL,
          NODE_ENV: process.env.NODE_ENV || 'test'
        },
        stdout: 'inherit',
        stderr: 'inherit'
      }
    );

    const exitCode = await testProcess.exited;
    if (exitCode !== 0) {
      throw new Error(
        `Live web security suite failed with exit code ${exitCode}`
      );
    }
  } finally {
    apiProcess.kill();
    webProcess.kill();
    await Promise.allSettled([apiProcess.exited, webProcess.exited]);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Failed to run live web security suite'
  );
  process.exit(1);
});
