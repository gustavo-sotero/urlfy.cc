import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type SchemaType =
  | 'array'
  | 'boolean'
  | 'integer'
  | 'null'
  | 'number'
  | 'object'
  | 'string'
  | 'Uint8Array'
  | 'void';

interface JsonSchema {
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: unknown;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  items?: JsonSchema;
  nullable?: boolean;
  oneOf?: JsonSchema[];
  parameters?: JsonSchema[];
  patternProperties?: Record<string, JsonSchema>;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  target?: string;
  type?: SchemaType | SchemaType[];
}

interface ParameterObject {
  in: 'cookie' | 'header' | 'path' | 'query';
  name: string;
  required?: boolean;
  schema?: JsonSchema;
}

interface MediaTypeObject {
  schema?: JsonSchema;
}

interface RequestBodyObject {
  content?: Record<string, MediaTypeObject>;
  required?: boolean;
}

type ResponseContent = JsonSchema | Record<string, MediaTypeObject>;

interface ResponseObject {
  content?: ResponseContent;
}

interface OperationObject {
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  tags?: string[];
}

type HttpMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';

type PathItemObject = Partial<Record<HttpMethod, OperationObject>>;

interface OpenAPIDocument {
  components?: {
    schemas?: Record<string, JsonSchema>;
  };
  paths?: Record<string, PathItemObject>;
}

const mode = process.argv.includes('--check') ? 'check' : 'write';
export const specPath = resolve(import.meta.dir, '../openapi-spec.json');
export const outputPath = resolve(
  import.meta.dir,
  '../packages/contracts/src/generated/api.ts'
);
export const clientOutputPath = resolve(
  import.meta.dir,
  '../packages/contracts/src/generated/client.ts'
);

export const componentExports = [
  ['response.api-error', 'ApiError'],
  ['response.error', 'ApiErrorResponse'],
  ['response.pagination', 'PaginationMeta'],
  ['links.create', 'CreateLinkInputSchema'],
  ['links.update', 'UpdateLinkInputSchema'],
  ['links.list.query', 'ListLinksQuerySchema'],
  ['links.qr.query', 'QrCodeQuery'],
  ['links.response', 'LinkResponse'],
  ['links.preview.response', 'LinkPreviewResponse'],
  ['links.stats.response', 'LinkStatsResponse'],
  ['links.dashboard.summary', 'DashboardSummaryResponse'],
  ['links.url.validate.response', 'UrlValidationResponse'],
  ['links.password.verify.response', 'VerifyPasswordResponse'],
  ['analytics.query', 'AnalyticsQuery'],
  ['analytics.days.query', 'AnalyticsDaysQuery'],
  ['analytics.daysWithLimit.query', 'AnalyticsDaysWithLimitQuery'],
  ['analytics.summary', 'AnalyticsSummary'],
  ['analytics.breakdown', 'AnalyticsBreakdown'],
  ['analytics.referrer.item', 'AnalyticsReferrerBreakdownItem'],
  ['analytics.breakdown.country', 'AnalyticsCountryBreakdownItem'],
  ['analytics.breakdown.device', 'AnalyticsDeviceBreakdownItem'],
  ['analytics.breakdown.browser', 'AnalyticsBreakdownItem'],
  ['analytics.timeseries.datapoint', 'TimeseriesDataPoint'],
  ['analytics.timeseries', 'AnalyticsTimeseries'],
  ['analytics.health.response', 'AnalyticsHealthResponse'],
  ['users.profile', 'UserProfileResponse'],
  ['users.quota', 'UserQuotaResponse'],
  ['users.export', 'UserDataExportResponse'],
  ['users.deletion.response', 'DataDeletionRequestResponse'],
  ['users.deletion.status', 'DataDeletionRequestStatus'],
  ['users.consent.body', 'UserConsentBody'],
  ['users.consent.response', 'UserConsentResponse'],
  ['users.consent.save.response', 'UserConsentSaveResponse'],
  ['api-keys.create', 'CreateApiKeyRequest'],
  ['api-keys.response', 'ApiKeyPublicResponse'],
  ['api-keys.created', 'ApiKeyCreatedResponse'],
  ['api-keys.list', 'ApiKeysListResponse'],
  ['api-keys.revoke', 'ApiKeyRevokeRequest'],
  ['admin.stats.response', 'AdminStatsResponse'],
  ['admin.growth.response', 'GrowthStatsPoint'],
  ['admin.growth.query', 'AdminGrowthQuery'],
  ['admin.domain.ban.body', 'AdminBanDomainBody'],
  ['admin.domain.ban.response', 'AdminBanDomainResponse'],
  ['admin.link.ban.body', 'AdminBanLinkBody'],
  ['admin.link.response', 'AdminLinkResponse'],
  ['admin.user.list.query', 'AdminUsersQuery'],
  ['admin.user.response', 'AdminUserResponse'],
  ['admin.user.update.body', 'UpdateAdminUserRequest'],
  ['admin.audit.query', 'AuditLogsQuery'],
  ['admin.audit.response', 'AuditLogEntryResponse'],
  ['admin.audit.stats.summary', 'AuditStatsSummaryResponse'],
  ['admin.queue.stream.stats', 'AdminQueueStreamStats'],
  ['contact.admin.message', 'ContactMessage'],
  ['contact.list', 'ContactMessagesQuery'],
  ['contact.update', 'UpdateContactMessageRequest']
] as const;

const componentNameMap = new Map<string, string>(componentExports);
const componentTypeNames = componentExports.map(([, exportName]) => exportName);
const edenClientAudienceTags = {
  dashboard: ['Admin', 'API Keys', 'Links', 'Stats', 'Analytics', 'User'],
  publicV1: ['Public API V1', 'Public API V1 - Links']
} as const;
const edenClientExcludedTags = new Set([
  '2FA',
  'Auth',
  'Default',
  'Health',
  'Internal',
  'Sessions'
]);
const httpMethodOrder: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

interface EdenOperationSpec {
  method: HttpMethod;
  queryType?: string;
  requestBodyOptional: boolean;
  requestBodyType?: string;
  responseType: string;
}

interface EdenRouteNode {
  operations: Partial<Record<HttpMethod, EdenOperationSpec>>;
  parameterChildren: Map<string, EdenRouteNode>;
  staticChildren: Map<string, EdenRouteNode>;
}

function createEdenRouteNode(): EdenRouteNode {
  return {
    operations: {},
    parameterChildren: new Map<string, EdenRouteNode>(),
    staticChildren: new Map<string, EdenRouteNode>()
  };
}

function propertyName(name: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return name;
  return JSON.stringify(name);
}

function quoteTsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function literal(value: unknown): string {
  if (typeof value === 'string') return quoteTsString(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) return 'null';
  return 'unknown';
}

function uniqueUnion(parts: string[]): string {
  const unique = [...new Set(parts.filter((part) => part !== 'never'))];
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
  if (schema.target === 'Partial' && schema.parameters?.[0]) {
    return `Partial<${schemaToType(schema.parameters[0])}>`;
  }
  if (schema.const !== undefined) return literal(schema.const);
  if (schema.enum) return uniqueUnion(schema.enum.map(literal));
  if (
    schema.default !== undefined &&
    !schema.type &&
    !schema.$ref &&
    !schema.anyOf &&
    !schema.oneOf &&
    !schema.allOf &&
    !schema.properties &&
    !schema.items &&
    !schema.enum &&
    schema.const === undefined
  ) {
    return 'never';
  }

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
  if (schema.format === 'binary' || schema.type === 'Uint8Array') {
    return 'Uint8Array';
  }
  if (schema.type === 'void') return 'void';
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
    if (schema.patternProperties) {
      const valueType = uniqueUnion(
        Object.values(schema.patternProperties).map(schemaToType)
      );
      return `Record<string, ${valueType}>`;
    }

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

function generatedClientHeader(): string {
  return `/**
 * Generated Eden Treaty route contract.
 *
 * Source: openapi-spec.json
 * Generator: scripts/generate-api-contracts.ts
 * Included audiences: ${Object.keys(edenClientAudienceTags).join(', ')} (derived from OpenAPI operation tags)
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

export function generateContracts(spec: OpenAPIDocument): string {
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

const edenClientTagSet = new Set<string>(
  Object.values(edenClientAudienceTags).flatMap((tags) => tags)
);

function shouldIncludeEdenOperation(operation: OperationObject): boolean {
  const tags = operation.tags ?? [];
  if (tags.length === 0) return false;
  if (tags.some((tag) => edenClientExcludedTags.has(tag))) return false;
  return tags.some((tag) => edenClientTagSet.has(tag));
}

function parsePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function routeInterfaceName(parts: string[]): string {
  if (parts.length === 0) return 'ApiRoutes';

  const suffix = parts
    .map((part) => {
      if (part.startsWith(':')) {
        return `With${toPascalCase(part.slice(1))}`;
      }
      return toPascalCase(part);
    })
    .join('');

  return `Api${suffix}Routes`;
}

function buildParameterObjectType(
  parameters: ParameterObject[] | undefined,
  location: ParameterObject['in']
): string | undefined {
  const matching = parameters?.filter((parameter) => parameter.in === location);
  if (!matching?.length) return undefined;

  const properties = Object.fromEntries(
    matching.map((parameter) => [parameter.name, parameter.schema ?? {}])
  ) as Record<string, JsonSchema>;
  const required = matching
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name);

  return objectType({
    properties,
    required,
    type: 'object'
  });
}

function isJsonSchemaCandidate(
  content: ResponseContent | undefined
): content is JsonSchema {
  if (!content || Array.isArray(content) || typeof content !== 'object') {
    return false;
  }

  return [
    '$ref',
    'type',
    'anyOf',
    'oneOf',
    'allOf',
    'properties',
    'items',
    'enum',
    'const',
    'default'
  ].some((key) => key in content);
}

function getJsonSchemaFromContent(
  content: ResponseContent | undefined
): JsonSchema | undefined {
  if (!content) return undefined;
  if (isJsonSchemaCandidate(content)) return content;

  return (
    content['application/json']?.schema ??
    Object.values(content).find((mediaType) => mediaType?.schema)?.schema
  );
}

function getSuccessResponseSchema(
  responses: Record<string, ResponseObject> | undefined
): JsonSchema | undefined {
  if (!responses) return undefined;

  const [response] = Object.entries(responses)
    .filter(([statusCode]) => /^2\d\d$/.test(statusCode))
    .sort(([left], [right]) => Number(left) - Number(right));

  if (!response) return undefined;
  return getJsonSchemaFromContent(response[1].content);
}

function extractResponseType(operation: OperationObject): string {
  const schema = getSuccessResponseSchema(operation.responses);
  if (!schema) return 'unknown';

  if (schema.properties?.data) {
    return schemaToType(schema.properties.data);
  }

  return schemaToType(schema);
}

function createEdenOperationSpec(
  method: HttpMethod,
  operation: OperationObject
): EdenOperationSpec {
  const requestBodySchema = getJsonSchemaFromContent(
    operation.requestBody?.content
  );

  return {
    method,
    queryType: buildParameterObjectType(operation.parameters, 'query'),
    requestBodyOptional: operation.requestBody?.required !== true,
    requestBodyType: requestBodySchema
      ? schemaToType(requestBodySchema)
      : undefined,
    responseType: extractResponseType(operation)
  };
}

function buildEdenRouteTree(spec: OpenAPIDocument): EdenRouteNode {
  const root = createEdenRouteNode();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    const segments = parsePathSegments(path);
    if (segments[0] !== 'api') continue;

    const includedOperations = httpMethodOrder.flatMap((method) => {
      const operation = pathItem[method];
      if (!operation || !shouldIncludeEdenOperation(operation)) {
        return [];
      }

      return [[method, operation] as const];
    });

    if (includedOperations.length === 0) continue;

    let current = root;
    for (const segment of segments.slice(1)) {
      const parameterMatch = /^\{(.+)\}$/.exec(segment);
      if (parameterMatch) {
        const parameterName = parameterMatch[1];
        const parameterNode =
          current.parameterChildren.get(parameterName) ?? createEdenRouteNode();
        current.parameterChildren.set(parameterName, parameterNode);
        current = parameterNode;
        continue;
      }

      const staticNode =
        current.staticChildren.get(segment) ?? createEdenRouteNode();
      current.staticChildren.set(segment, staticNode);
      current = staticNode;
    }

    for (const [method, operation] of includedOperations) {
      current.operations[method] = createEdenOperationSpec(method, operation);
    }
  }

  return root;
}

function collectReferencedComponentTypes(
  typeText: string,
  usedTypes: Set<string>
): void {
  for (const componentTypeName of componentTypeNames) {
    const matcher = new RegExp(`\\b${componentTypeName}\\b`);
    if (matcher.test(typeText)) {
      usedTypes.add(componentTypeName);
    }
  }
}

function collectEdenRouteTypes(
  node: EdenRouteNode,
  usedTypes: Set<string>
): void {
  for (const operation of Object.values(node.operations)) {
    if (!operation) continue;
    collectReferencedComponentTypes(operation.responseType, usedTypes);
    if (operation.requestBodyType) {
      collectReferencedComponentTypes(operation.requestBodyType, usedTypes);
    }
    if (operation.queryType) {
      collectReferencedComponentTypes(operation.queryType, usedTypes);
    }
  }

  for (const child of node.staticChildren.values()) {
    collectEdenRouteTypes(child, usedTypes);
  }

  for (const child of node.parameterChildren.values()) {
    collectEdenRouteTypes(child, usedTypes);
  }
}

function indentType(typeText: string, spaces: number): string {
  return typeText.replace(/\n/g, `\n${' '.repeat(spaces)}`);
}

function renderEdenMethodSignature(operation: EdenOperationSpec): string {
  const args: string[] = [];

  if (operation.requestBodyType) {
    const requestBodyType = indentType(operation.requestBodyType, 10);
    const requestBodyArg = operation.requestBodyOptional ? 'body?' : 'body';
    args.push(`${requestBodyArg}: ${requestBodyType}`);
  }

  if (operation.queryType) {
    const queryType = indentType(operation.queryType, 16);
    args.push(`options?: { query?: ${queryType} }`);
  }

  const responseType = indentType(operation.responseType, 8);
  return `(${args.join(', ')}): Promise<ApiClientResponse<${responseType}>>`;
}

function renderEdenRouteInterfaces(
  node: EdenRouteNode,
  parts: string[] = [],
  renderedInterfaces: string[] = []
): string[] {
  const lines = [`export interface ${routeInterfaceName(parts)} {`];

  for (const [parameterName] of [...node.parameterChildren.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    lines.push(
      `  (params: { ${parameterName}: string }): ${routeInterfaceName([...parts, `:${parameterName}`])};`
    );
  }

  for (const method of httpMethodOrder) {
    const operation = node.operations[method];
    if (!operation) continue;
    lines.push(`  ${method}${renderEdenMethodSignature(operation)};`);
  }

  for (const [segment] of [...node.staticChildren.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    lines.push(
      `  ${propertyName(segment)}: ${routeInterfaceName([...parts, segment])};`
    );
  }

  lines.push('}');
  renderedInterfaces.push(lines.join('\n'));

  for (const [segment, child] of [...node.staticChildren.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    renderEdenRouteInterfaces(child, [...parts, segment], renderedInterfaces);
  }

  for (const [parameterName, child] of [
    ...node.parameterChildren.entries()
  ].sort(([left], [right]) => left.localeCompare(right))) {
    renderEdenRouteInterfaces(
      child,
      [...parts, `:${parameterName}`],
      renderedInterfaces
    );
  }

  return renderedInterfaces;
}

export function generateEdenClientContract(spec: OpenAPIDocument): string {
  const routeTree = buildEdenRouteTree(spec);
  const referencedComponentTypes = new Set<string>();
  collectEdenRouteTypes(routeTree, referencedComponentTypes);

  const imports = [
    "import type { ApiClientResponse } from '../api-client-shared';"
  ];
  if (referencedComponentTypes.size > 0) {
    imports.push(
      `import type { ${[...referencedComponentTypes].sort().join(', ')} } from './api';`
    );
  }

  const routeInterfaces = renderEdenRouteInterfaces(routeTree);

  return `${generatedClientHeader()}\n\n${imports.join('\n')}\n\n${routeInterfaces.join('\n\n')}\n\nexport interface GeneratedEdenApiClient {\n  api: ApiRoutes;\n}\n`;
}

export async function readOpenApiSpec(): Promise<OpenAPIDocument> {
  return JSON.parse(await readFile(specPath, 'utf8')) as OpenAPIDocument;
}

export async function readGeneratedContracts(): Promise<string> {
  return readFile(outputPath, 'utf8');
}

export async function readGeneratedEdenClientContract(): Promise<string> {
  return readFile(clientOutputPath, 'utf8');
}

async function main(): Promise<void> {
  const spec = await readOpenApiSpec();
  const nextContent = generateContracts(spec);
  const nextClientContent = generateEdenClientContract(spec);

  if (mode === 'write') {
    await mkdir(dirname(outputPath), { recursive: true });
    await Promise.all([
      writeFile(outputPath, nextContent),
      writeFile(clientOutputPath, nextClientContent)
    ]);
    process.stdout.write(
      `Generated ${outputPath}\nGenerated ${clientOutputPath}\n`
    );
    return;
  }

  const [currentContent, currentClientContent] = await Promise.all([
    readFile(outputPath, 'utf8').catch(() => ''),
    readFile(clientOutputPath, 'utf8').catch(() => '')
  ]);

  if (
    currentContent === nextContent &&
    currentClientContent === nextClientContent
  ) {
    process.stdout.write('generated API contracts are up to date\n');
    return;
  }

  process.stderr.write(
    'generated API contracts are out of date. Run bun run contracts:generate.\n'
  );
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
}
