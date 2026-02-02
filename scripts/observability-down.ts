import { existsSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(import.meta.dir, '..');
const signozDir = resolve(projectRoot, '..', 'signoz');
const signozDockerDir = resolve(signozDir, 'deploy', 'docker');
const urlfyDockerDir = resolve(projectRoot, 'docker');

const runCmd = (command: string, args: string[], cwd: string) => {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit'
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (exit ${result.exitCode})`
    );
  }
};

const ensureDockerRunning = () => {
  const result = Bun.spawnSync(['docker', 'info'], {
    stdout: 'ignore',
    stderr: 'pipe'
  });

  if (result.exitCode === 0) return;

  const stderr = new TextDecoder().decode(result.stderr).toLowerCase();
  const isWindows = process.platform === 'win32';
  const hint = isWindows
    ? 'Start Docker Desktop with WSL2 backend, then re-run the command.'
    : 'Start the Docker daemon, then re-run the command.';

  const details = stderr ? `\nDocker error: ${stderr.trim()}` : '';
  throw new Error(`Docker is not available. ${hint}${details}`);
};

const main = () => {
  ensureDockerRunning();
  console.log('[Observability] Stopping urlfy (SigNoz override)...');
  runCmd(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '-f',
      'docker-compose.signoz.yml',
      'down'
    ],
    urlfyDockerDir
  );

  if (!existsSync(signozDir)) {
    console.log(
      '[Observability] SigNoz repo not found. Skipping SigNoz shutdown.'
    );
    return;
  }

  console.log('[Observability] Stopping SigNoz stack...');
  runCmd('docker', ['compose', 'down'], signozDockerDir);
};

main();
