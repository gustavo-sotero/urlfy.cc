import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type OpenAPIDocument = Record<string, unknown>;

const mode = process.argv.includes('--check') ? 'check' : 'write';
const outputPath = resolve(import.meta.dir, '../../../openapi-spec.json');

function setDefaultEnv(): void {
  process.env.NODE_ENV ??= 'test';
  process.env.SKIP_ENV_VALIDATION ??= '1';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-minimum-32-characters-long';
  process.env.JWT_SECRET ??= 'test-jwt-secret-minimum-32-characters';
  process.env.INTERNAL_API_SECRET ??= 'test-internal-secret-minimum-32-chars';
  process.env.INTERNAL_ANALYTICS_SECRET ??=
    'test-analytics-secret-minimum-32-chars';
  process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
  process.env.ADMIN_GITHUB_ACCOUNT_ID ??= 'test-admin-github-account-id';
}

async function loadSpec(): Promise<OpenAPIDocument> {
  setDefaultEnv();

  const [{ getElysiaOpenApiSpec }, { getMergedOpenAPISpec }] =
    await Promise.all([
      import('../src/server/index'),
      import('../src/server/lib/openapi-merger')
    ]);

  const spec = (await getMergedOpenAPISpec(async () =>
    getElysiaOpenApiSpec()
  )) as unknown as OpenAPIDocument;
  if (spec['x-docs-degraded']) {
    throw new Error('OpenAPI generation produced a degraded spec');
  }

  return spec;
}

function stringifySpec(spec: OpenAPIDocument): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

async function main(): Promise<void> {
  const nextContent = stringifySpec(await loadSpec());

  if (mode === 'write') {
    await writeFile(outputPath, nextContent);
    process.stdout.write(`Generated ${outputPath}\n`);
    process.exit(0);
  }

  const currentContent = await readFile(outputPath, 'utf8').catch(() => '');
  if (currentContent === nextContent) {
    process.stdout.write('openapi-spec.json is up to date\n');
    process.exit(0);
  }

  process.stderr.write(
    'openapi-spec.json is out of date. Run bun run openapi:generate.\n'
  );
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
