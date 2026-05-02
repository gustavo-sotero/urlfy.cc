import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type SchemaType =
  | 'array'
  | 'boolean'
  | 'integer'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

interface JsonSchema {
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  nullable?: boolean;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: SchemaType | SchemaType[];
}

interface OpenAPIDocument {
  components?: {
    schemas?: Record<string, JsonSchema>;
  };
}

const mode = process.argv.includes('--check') ? 'check' : 'write';
const specPath = resolve(import.meta.dir, '../openapi-spec.json');
const outputPath = resolve(
  import.meta.dir,
  '../packages/contracts/src/generated/api.ts'
);

const componentExports = [
  ['response.api-error', 'ApiError'],
  ['response.error', 'ApiErrorResponse'],
  ['response.pagination', 'PaginationMeta'],
  ['links.create', 'CreateLinkInputSchema'],
  ['links.update', 'UpdateLinkInputSchema'],
  ['links.list.query', 'ListLinksQuerySchema'],
  ['links.response', 'LinkResponse'],
  ['links.preview.response', 'LinkPreviewResponse'],
  ['links.stats.response', 'LinkStatsResponse'],
  ['links.dashboard.summary', 'DashboardSummaryResponse'],
  ['links.url.validate.response', 'UrlValidationResponse'],
  ['links.password.verify.response', 'VerifyPasswordResponse'],
  ['analytics.summary', 'AnalyticsSummary'],
  ['analytics.breakdown', 'AnalyticsBreakdown'],
  ['analytics.timeseries.datapoint', 'TimeseriesDataPoint'],
  ['analytics.timeseries', 'AnalyticsTimeseries'],
  ['users.quota', 'UserQuotaResponse'],
  ['users.export', 'UserDataExportResponse'],
  ['users.deletion.response', 'DataDeletionRequestResponse'],
  ['api-keys.create', 'CreateApiKeyRequest'],
  ['api-keys.response', 'ApiKeyPublicResponse'],
  ['api-keys.created', 'ApiKeyCreatedResponse'],
  ['api-keys.list', 'ApiKeysListResponse'],
  ['api-keys.revoke', 'ApiKeyRevokeRequest'],
  ['admin.stats.response', 'AdminStatsResponse'],
  ['admin.growth.response', 'GrowthStatsPoint'],
  ['admin.growth.query', 'AdminGrowthQuery'],
  ['admin.link.response', 'AdminLinkResponse'],
  ['admin.user.list.query', 'AdminUsersQuery'],
  ['admin.user.response', 'AdminUserResponse'],
  ['admin.user.update.body', 'UpdateAdminUserRequest'],
  ['admin.audit.query', 'AuditLogsQuery'],
  ['admin.audit.response', 'AuditLogEntryResponse']
] as const;

const componentNameMap = new Map<string, string>(componentExports);

function propertyName(name: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return name;
  return JSON.stringify(name);
}

function quoteTsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function literal(value: unknown): string {
  if (typeof value === 'string') return quoteTsString(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value === null) return 'null';
  return 'unknown';
}

function uniqueUnion(parts: string[]): string {
  const unique = [...new Set(parts)];
  if (unique.length === 0) return 'unknown';
  if (unique.length === 1) return unique[0];
  return unique.join(' | ');
}

function refName(ref: string): string {
  const componentName = ref.replace('#/components/schemas/', '');
  return componentNameMap.get(componentName) ?? 'unknown';
}

function isNumericStringSchema(schema: JsonSchema): boolean {
  return (
    schema.type === 'string' &&
    (schema.format === 'integer' ||
      schema.format === 'number' ||
      schema.format === 'float' ||
      schema.format === 'double')
  );
}

function schemaToType(schema: JsonSchema | undefined): string {
  if (!schema) return 'unknown';
  if (schema.$ref) return refName(schema.$ref);
  if (schema.const !== undefined) return literal(schema.const);
  if (schema.enum) return uniqueUnion(schema.enum.map(literal));

  if (schema.anyOf) {
    const parts = schema.anyOf.map(schemaToType);
    if (schema.nullable && !parts.includes('null')) parts.push('null');
    return uniqueUnion(parts);
  }

  if (schema.oneOf) {
    const parts = schema.oneOf.map(schemaToType);
    if (schema.nullable && !parts.includes('null')) parts.push('null');
    return uniqueUnion(parts);
  }

  if (schema.allOf) {
    return schema.allOf.map(schemaToType).join(' & ');
  }

  if (Array.isArray(schema.type)) {
    return uniqueUnion(
      schema.type.map((type) => schemaToType({ ...schema, type }))
    );
  }

  if (schema.type === 'null') return 'null';
  if (isNumericStringSchema(schema)) return 'number';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';

  if (schema.type === 'array') {
    const itemType = schemaToType(schema.items);
    if (!itemType.startsWith('{') && itemType.includes(' | ')) {
      return `Array<\n  | ${itemType.split(' | ').join('\n  | ')}\n>`;
    }
    if (itemType.includes(' | ') || itemType.includes(' & ')) {
      return `Array<${itemType}>`;
    }
    return `${itemType}[]`;
  }

  if (schema.type === 'object' || schema.properties) {
    return objectType(schema);
  }

  if (schema.nullable) return 'unknown | null';
  return 'unknown';
}

function objectType(schema: JsonSchema): string {
  const properties = schema.properties ?? {};
  const propertyEntries = Object.entries(properties);
  const required = new Set(schema.required ?? []);

  if (propertyEntries.length === 0) {
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    ) {
      return `Record<string, ${schemaToType(schema.additionalProperties)}>`;
    }
    return 'Record<string, unknown>';
  }

  const lines = ['{'];
  for (const [name, propertySchema] of propertyEntries) {
    const optional = required.has(name) ? '' : '?';
    const propertyType = schemaToType(propertySchema).replace(/\n/g, '\n  ');
    lines.push(`  ${propertyName(name)}${optional}: ${propertyType};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function renderInterface(name: string, schema: JsonSchema): string {
  const type = schemaToType(schema);
  if (/^\{[\s\S]*\}\s\|\s\{/.test(type)) {
    const union = type
      .split(' | ')
      .map((part) => `  | ${part.replace(/\n/g, '\n    ')}`)
      .join('\n');
    return `export type ${name} =\n${union};`;
  }
  if (type.includes(' & ') || type.includes(' | ')) {
    return `export type ${name} = ${type};`;
  }
  if (!type.startsWith('{')) return `export type ${name} = ${type};`;
  return `export interface ${name} ${type}`;
}

function generatedHeader(): string {
  return `/**
 * Generated API contracts.
 *
 * Source: openapi-spec.json
 * Generator: scripts/generate-api-contracts.ts
 * Do not edit this file by hand.
 */`;
}

function renderEnvelopeTypes(): string {
  return `export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;`;
}

function generateContracts(spec: OpenAPIDocument): string {
  const schemas = spec.components?.schemas;
  if (!schemas) {
    throw new Error('OpenAPI spec has no components.schemas section');
  }

  const rendered = componentExports.map(([componentName, exportName]) => {
    const schema = schemas[componentName];
    if (!schema) throw new Error(`Missing OpenAPI schema: ${componentName}`);
    return renderInterface(exportName, schema);
  });

  return `${generatedHeader()}\n\n${rendered.join('\n\n')}\n\n${renderEnvelopeTypes()}\n`;
}

async function main(): Promise<void> {
  const spec = JSON.parse(await readFile(specPath, 'utf8')) as OpenAPIDocument;
  const nextContent = generateContracts(spec);

  if (mode === 'write') {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, nextContent);
    process.stdout.write(`Generated ${outputPath}\n`);
    return;
  }

  const currentContent = await readFile(outputPath, 'utf8').catch(() => '');
  if (currentContent === nextContent) {
    process.stdout.write('generated API contracts are up to date\n');
    return;
  }

  process.stderr.write(
    'generated API contracts are out of date. Run bun run contracts:generate.\n'
  );
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
