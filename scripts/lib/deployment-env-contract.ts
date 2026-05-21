import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

type RuntimeServiceName = 'api' | 'web' | 'worker';
export type ServiceName = RuntimeServiceName | 'migrate';

export interface RuntimeEnvContract {
  allKeys: string[];
  schemaRequiredKeys: string[];
}

export interface ServiceContractReport {
  service: ServiceName;
  requiredKeys: string[];
  missingInCompose: string[];
  missingInExample: string[];
}

export interface DeploymentEnvContractReport {
  services: ServiceContractReport[];
  errors: string[];
}

type ComposeEnvAssignments = Map<string, Map<string, string>>;

const RUNTIME_SERVICE_FILES: Record<RuntimeServiceName, string> = {
  api: 'apps/api/src/lib/env.ts',
  web: 'apps/web/src/lib/env.ts',
  worker: 'apps/worker/src/lib/env.ts'
};

const DEPLOYMENT_REQUIRED_OVERRIDES: Record<
  RuntimeServiceName,
  readonly string[]
> = {
  api: [
    'NEXT_PUBLIC_APP_URL',
    'BETTER_AUTH_URL',
    'REDIS_URL',
    'TRUST_PROXY',
    'TRUST_PROXY_HOPS',
    'TRUST_PROXY_PROVIDER',
    'TRUSTED_PROXY_CIDRS'
  ],
  web: [
    'NEXT_PUBLIC_APP_URL',
    'BETTER_AUTH_URL',
    'API_INTERNAL_URL',
    'REDIS_URL',
    'TRUST_PROXY',
    'TRUST_PROXY_HOPS',
    'TRUST_PROXY_PROVIDER',
    'TRUSTED_PROXY_CIDRS'
  ],
  worker: ['REDIS_URL']
};

const PRODUCTION_REQUIRED_OVERRIDES: Record<
  RuntimeServiceName,
  readonly string[]
> = {
  api: ['ADMIN_GITHUB_ACCOUNT_ID', 'JWT_SECRET', 'INTERNAL_ANALYTICS_SECRET'],
  web: ['JWT_SECRET', 'INTERNAL_ANALYTICS_SECRET'],
  worker: ['INTERNAL_ANALYTICS_SECRET']
};

const MIGRATE_REQUIRED_KEYS = [
  'DATABASE_URL',
  'MIGRATION_TIMEOUT',
  'DB_CHECK_TIMEOUT',
  'SKIP_MIGRATIONS'
] as const;

const COMPOSE_SHARED_VALUE_INVARIANTS = [
  {
    key: 'DATABASE_URL',
    services: ['api', 'web', 'worker', 'migrate'] as const
  },
  {
    key: 'REDIS_URL',
    services: ['api', 'web', 'worker'] as const
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    services: ['api', 'web'] as const
  },
  {
    key: 'BETTER_AUTH_SECRET',
    services: ['api', 'web'] as const
  },
  {
    key: 'BETTER_AUTH_URL',
    services: ['api', 'web'] as const
  },
  {
    key: 'JWT_SECRET',
    services: ['api', 'web'] as const
  },
  {
    key: 'INTERNAL_API_SECRET',
    services: ['api', 'web', 'worker'] as const
  },
  {
    key: 'INTERNAL_ANALYTICS_SECRET',
    services: ['api', 'web', 'worker'] as const
  },
  {
    key: 'TRUST_PROXY',
    services: ['api', 'web'] as const
  },
  {
    key: 'TRUST_PROXY_HOPS',
    services: ['api', 'web'] as const
  },
  {
    key: 'TRUST_PROXY_PROVIDER',
    services: ['api', 'web'] as const
  },
  {
    key: 'TRUSTED_PROXY_CIDRS',
    services: ['api', 'web'] as const
  }
] as const;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null;
}

function expressionContainsCall(
  expression: ts.Expression,
  methodName: string
): boolean {
  if (ts.isParenthesizedExpression(expression)) {
    return expressionContainsCall(expression.expression, methodName);
  }

  if (ts.isCallExpression(expression)) {
    if (
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === methodName
    ) {
      return true;
    }

    if (ts.isPropertyAccessExpression(expression.expression)) {
      return expressionContainsCall(
        expression.expression.expression,
        methodName
      );
    }

    return expressionContainsCall(expression.expression, methodName);
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expressionContainsCall(expression.expression, methodName);
  }

  return false;
}

function findEnvSchemaObjectLiteral(
  sourceFile: ts.SourceFile
): ts.ObjectLiteralExpression {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (declaration.name.text !== 'envSchema') continue;
      if (!declaration.initializer) continue;
      if (!ts.isCallExpression(declaration.initializer)) continue;
      if (!ts.isPropertyAccessExpression(declaration.initializer.expression)) {
        continue;
      }
      if (declaration.initializer.expression.name.text !== 'object') continue;

      const [schemaArg] = declaration.initializer.arguments;
      if (!schemaArg || !ts.isObjectLiteralExpression(schemaArg)) {
        throw new Error('envSchema must be declared with z.object({...})');
      }

      return schemaArg;
    }
  }

  throw new Error('Could not locate envSchema declaration');
}

export function extractRuntimeEnvContract(
  sourceText: string,
  filePath = 'env.ts'
): RuntimeEnvContract {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const objectLiteral = findEnvSchemaObjectLiteral(sourceFile);
  const allKeys: string[] = [];
  const schemaRequiredKeys: string[] = [];

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const key = getPropertyNameText(property.name);
    if (!key) continue;

    allKeys.push(key);

    const hasOptional = expressionContainsCall(
      property.initializer,
      'optional'
    );
    const hasDefault = expressionContainsCall(property.initializer, 'default');

    if (!hasOptional && !hasDefault) {
      schemaRequiredKeys.push(key);
    }
  }

  return {
    allKeys: uniqueSorted(allKeys),
    schemaRequiredKeys: uniqueSorted(schemaRequiredKeys)
  };
}

export function collectDocumentedEnvVariables(sourceText: string): Set<string> {
  const names = new Set<string>();

  for (const line of sourceText.split(/\r?\n/u)) {
    const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/u);
    if (!match) continue;
    names.add(match[1]);
  }

  return names;
}

export function collectComposeServiceEnvAssignments(
  sourceText: string
): ComposeEnvAssignments {
  const envByService: ComposeEnvAssignments = new Map();
  const lines = sourceText.split(/\r?\n/u);
  let currentService: string | null = null;
  let inEnvironmentBlock = false;

  for (const line of lines) {
    if (/^[^\s]/u.test(line) && !line.startsWith('services:')) {
      currentService = null;
      inEnvironmentBlock = false;
      continue;
    }

    const serviceMatch = line.match(/^ {2}([a-z0-9-]+):\s*$/u);
    if (serviceMatch) {
      currentService = serviceMatch[1];
      inEnvironmentBlock = false;
      envByService.set(
        currentService,
        envByService.get(currentService) ?? new Map()
      );
      continue;
    }

    if (!currentService) continue;

    if (/^ {4}environment:\s*$/u.test(line)) {
      inEnvironmentBlock = true;
      continue;
    }

    if (inEnvironmentBlock) {
      const envMatch = line.match(/^\s*-\s*([A-Z][A-Z0-9_]+)=(.*)$/u);
      if (envMatch) {
        envByService.get(currentService)?.set(envMatch[1], envMatch[2].trim());
        continue;
      }

      if (/^ {4}[a-zA-Z]/u.test(line) || /^ {2}[a-z0-9-]+:/u.test(line)) {
        inEnvironmentBlock = false;
      }
    }
  }

  return envByService;
}

export function collectComposeServiceEnvVariables(
  sourceText: string
): Map<string, Set<string>> {
  const assignments = collectComposeServiceEnvAssignments(sourceText);

  return new Map(
    [...assignments.entries()].map(([service, values]) => [
      service,
      new Set(values.keys())
    ])
  );
}

export function findComposeSharedValueDrift(
  envByService: ComposeEnvAssignments
): string[] {
  const errors: string[] = [];

  for (const invariant of COMPOSE_SHARED_VALUE_INVARIANTS) {
    const entries = invariant.services.map((service) => ({
      service,
      value: envByService.get(service)?.get(invariant.key)
    }));

    if (entries.some((entry) => entry.value === undefined)) {
      continue;
    }

    const normalizedEntries = entries.map((entry) => ({
      service: entry.service,
      value: entry.value?.trim() ?? ''
    }));
    const [baseline, ...rest] = normalizedEntries;

    if (rest.every((entry) => entry.value === baseline.value)) {
      continue;
    }

    const mismatchDetails = normalizedEntries
      .map((entry) => `${entry.service}=${entry.value}`)
      .join('; ');

    errors.push(
      `compose invariant drift for ${invariant.key} -> ${mismatchDetails}`
    );
  }

  return errors;
}

function getRequiredKeysForRuntimeService(
  service: RuntimeServiceName,
  contract: RuntimeEnvContract
): string[] {
  return uniqueSorted([
    ...contract.schemaRequiredKeys,
    ...DEPLOYMENT_REQUIRED_OVERRIDES[service],
    ...PRODUCTION_REQUIRED_OVERRIDES[service]
  ]);
}

export async function loadRuntimeServiceContract(
  repoRoot: string,
  service: RuntimeServiceName
): Promise<RuntimeEnvContract> {
  const filePath = resolve(repoRoot, RUNTIME_SERVICE_FILES[service]);
  const sourceText = await readFile(filePath, 'utf8');
  return extractRuntimeEnvContract(sourceText, filePath);
}

export async function validateDeploymentEnvContract(
  repoRoot: string
): Promise<DeploymentEnvContractReport> {
  const [
    exampleSource,
    composeSource,
    apiContract,
    webContract,
    workerContract
  ] = await Promise.all([
    readFile(resolve(repoRoot, '.env.example'), 'utf8'),
    readFile(resolve(repoRoot, 'docker/docker-compose.prod.yml'), 'utf8'),
    loadRuntimeServiceContract(repoRoot, 'api'),
    loadRuntimeServiceContract(repoRoot, 'web'),
    loadRuntimeServiceContract(repoRoot, 'worker')
  ]);

  const documentedEnv = collectDocumentedEnvVariables(exampleSource);
  const composeEnvAssignmentsByService =
    collectComposeServiceEnvAssignments(composeSource);
  const composeEnvByService = collectComposeServiceEnvVariables(composeSource);
  const services: ServiceContractReport[] = [];
  const errors = findComposeSharedValueDrift(composeEnvAssignmentsByService);

  const runtimeContracts = {
    api: apiContract,
    web: webContract,
    worker: workerContract
  } as const satisfies Record<RuntimeServiceName, RuntimeEnvContract>;

  for (const service of ['api', 'web', 'worker'] as const) {
    const requiredKeys = getRequiredKeysForRuntimeService(
      service,
      runtimeContracts[service]
    );
    const composeKeys = composeEnvByService.get(service) ?? new Set<string>();
    const missingInCompose = requiredKeys.filter(
      (key) => !composeKeys.has(key)
    );
    const missingInExample = requiredKeys.filter(
      (key) => !documentedEnv.has(key)
    );

    services.push({
      service,
      requiredKeys,
      missingInCompose,
      missingInExample
    });

    if (missingInCompose.length > 0) {
      errors.push(
        `${service}: missing in docker/docker-compose.prod.yml -> ${missingInCompose.join(', ')}`
      );
    }

    if (missingInExample.length > 0) {
      errors.push(
        `${service}: missing in .env.example -> ${missingInExample.join(', ')}`
      );
    }
  }

  const migrateComposeKeys =
    composeEnvByService.get('migrate') ?? new Set<string>();
  const migrateMissingInCompose = MIGRATE_REQUIRED_KEYS.filter(
    (key) => !migrateComposeKeys.has(key)
  );
  const migrateMissingInExample = MIGRATE_REQUIRED_KEYS.filter(
    (key) => !documentedEnv.has(key)
  );

  services.push({
    service: 'migrate',
    requiredKeys: [...MIGRATE_REQUIRED_KEYS],
    missingInCompose: migrateMissingInCompose,
    missingInExample: migrateMissingInExample
  });

  if (migrateMissingInCompose.length > 0) {
    errors.push(
      `migrate: missing in docker/docker-compose.prod.yml -> ${migrateMissingInCompose.join(', ')}`
    );
  }

  if (migrateMissingInExample.length > 0) {
    errors.push(
      `migrate: missing in .env.example -> ${migrateMissingInExample.join(', ')}`
    );
  }

  return { services, errors };
}

export function formatDeploymentEnvContractReport(
  report: DeploymentEnvContractReport
): string {
  const lines = ['Deployment env contract check'];

  for (const service of report.services) {
    lines.push(
      `- ${service.service}: validated ${service.requiredKeys.length} required vars`
    );
  }

  if (report.errors.length === 0) {
    lines.push('Status: OK');
    return lines.join('\n');
  }

  lines.push('Status: drift detected');
  for (const error of report.errors) {
    lines.push(`  ${error}`);
  }

  return lines.join('\n');
}
