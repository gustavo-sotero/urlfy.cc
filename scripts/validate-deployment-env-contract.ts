import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatDeploymentEnvContractReport,
  validateDeploymentEnvContract
} from './lib/deployment-env-contract';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '..');

const report = await validateDeploymentEnvContract(repoRoot);
const output = formatDeploymentEnvContractReport(report);

if (report.errors.length > 0) {
  console.error(output);
  process.exit(1);
}

console.log(output);
