#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

async function ensureScriptExists(scriptPath: string): Promise<string> {
  const absolutePath = resolve(process.cwd(), scriptPath);
  await access(absolutePath, constants.F_OK);
  return absolutePath;
}

async function run(): Promise<void> {
  const [, , scriptPath, ...args] = process.argv;

  if (!scriptPath) {
    throw new Error(
      'Missing k6 script path. Example: bun run scripts/run-k6.ts load/k6/redirect-hot-path.js'
    );
  }

  const resolvedScriptPath = await ensureScriptExists(scriptPath);
  const k6Binary = process.env.K6_BIN || 'k6';

  const child = spawn(k6Binary, ['run', resolvedScriptPath, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', (error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      process.stderr.write(
        'k6 binary not found. Install k6 or set K6_BIN to the executable path.\n'
      );
      process.stderr.write(
        'Docs: https://grafana.com/docs/k6/latest/set-up/install-k6/\n'
      );
      process.exit(1);
    }

    throw error;
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.stderr.write(`k6 terminated by signal ${signal}\n`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
