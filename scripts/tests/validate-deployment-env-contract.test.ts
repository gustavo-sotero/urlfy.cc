import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectComposeServiceEnvVariables,
  collectDocumentedEnvVariables,
  extractRuntimeEnvContract,
  validateDeploymentEnvContract
} from '../lib/deployment-env-contract';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../..');

describe('deployment env contract helpers', () => {
  test('collects documented variables from active and commented example lines', () => {
    const documented = collectDocumentedEnvVariables(`
      # JWT_SECRET=secret
      DATABASE_URL=postgres://localhost/urlfy
      # not-a-variable
      INTERNAL_ANALYTICS_SECRET=analytics
    `);

    expect(documented.has('JWT_SECRET')).toBe(true);
    expect(documented.has('DATABASE_URL')).toBe(true);
    expect(documented.has('INTERNAL_ANALYTICS_SECRET')).toBe(true);
  });

  test('collects compose env variables per service', () => {
    const envByService = collectComposeServiceEnvVariables(`
services:
  api:
    environment:
      - DATABASE_URL=
      - INTERNAL_API_SECRET=
  web:
    environment:
      - API_INTERNAL_URL=http://api:3001
volumes:
  data:
`);

    expect(envByService.get('api')).toEqual(
      new Set(['DATABASE_URL', 'INTERNAL_API_SECRET'])
    );
    expect(envByService.get('web')).toEqual(new Set(['API_INTERNAL_URL']));
  });

  test('extracts required keys from the runtime schema', async () => {
    const apiSource = await readFile(
      resolve(repoRoot, 'apps/api/src/lib/env.ts'),
      'utf8'
    );
    const contract = extractRuntimeEnvContract(
      apiSource,
      'apps/api/src/lib/env.ts'
    );

    expect(contract.schemaRequiredKeys).toContain('DATABASE_URL');
    expect(contract.schemaRequiredKeys).toContain('BETTER_AUTH_SECRET');
    expect(contract.schemaRequiredKeys).not.toContain('NEXT_PUBLIC_APP_URL');
    expect(contract.allKeys).toContain('ADMIN_GITHUB_ACCOUNT_ID');
  });
});

describe('deployment env contract', () => {
  test('current repo surfaces are in sync', async () => {
    const report = await validateDeploymentEnvContract(repoRoot);

    expect(report.errors).toEqual([]);
  });
});
