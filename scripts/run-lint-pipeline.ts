export {};

const lintSteps = [
  ['bun', 'x', 'turbo', 'run', 'lint', '--concurrency=6', '--log-order=stream'],
  ['bun', 'run', 'validate:catalog'],
  ['bun', 'run', 'scripts/validate-module-boundaries.ts'],
  ['bun', 'run', 'scripts/validate-proxy-headers.ts']
] as const;

for (const command of lintSteps) {
  const proc = Bun.spawn({
    cmd: [...command],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
