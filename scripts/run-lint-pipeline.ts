export {};

const lintSteps = [
  ['bun', 'x', 'turbo', 'run', 'lint', '--concurrency=1', '--log-order=stream'],
  ['bun', 'run', 'validate:catalog'],
  ['bun', 'run', 'scripts/validate-module-boundaries.ts'],
  ['bun', 'run', 'scripts/validate-proxy-headers.ts'],
  ['bun', 'run', 'contracts:check']
] as const;

for (const command of lintSteps) {
  const env = { ...process.env };
  if (command[2] === 'contracts:check') {
    delete env.SKIP_ENV_VALIDATION;
    env.NODE_ENV = 'test';
  }

  const proc = Bun.spawn({
    cmd: [...command],
    env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
