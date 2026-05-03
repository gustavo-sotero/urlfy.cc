import { describe, expect, it } from 'bun:test';

/**
 * Parity tests that verify app-local shim files are thin re-exports
 * from their canonical packages. If a shim diverges (contains logic
 * instead of re-exports), the test fails and signals drift.
 */

async function readFromApiRoot(relPath: string): Promise<string> {
  const url = new URL(`../../${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

async function readFromWebRoot(relPath: string): Promise<string> {
  const url = new URL(`../../../web/${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

async function readFromWorkerRoot(relPath: string): Promise<string> {
  const url = new URL(`../../../worker/${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

async function readFromWorkspaceRoot(relPath: string): Promise<string> {
  const url = new URL(`../../../../${relPath}`, import.meta.url);
  return Bun.file(url).text();
}

function workspaceFile(relPath: string): Bun.BunFile {
  const url = new URL(`../../../../${relPath}`, import.meta.url);
  return Bun.file(url);
}

function isReExportShim(source: string, canonicalPackage: string): boolean {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Must contain at least one re-export from the canonical package
  const reExportPattern = new RegExp(
    `export\\s+(?:type\\s+)?\\{[^}]+\\}\\s+from\\s+['"]${canonicalPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"]*)?['"]`
  );

  if (!reExportPattern.test(stripped)) return false;

  // Must NOT contain function bodies, class declarations, or variable assignments
  // (other than re-exports). Allow `export type` and `export { ... } from`.
  const lines = stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!line) continue;
    // Valid patterns: export { X } from '...', export type { X } from '...'
    if (/^export\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]/.test(line)) continue;
    // Invalid: any other statement
    return false;
  }

  return true;
}

// ── CacheService ─────────────────────────────────────────────────────────────

describe('CacheService shim parity', () => {
  it('API shim re-exports from @urlfy/redirect-domain', async () => {
    const source = await readFromApiRoot(
      'src/server/services/cache.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/redirect-domain')).toBe(true);
  });

  it('Worker shim re-exports from @urlfy/redirect-domain', async () => {
    const source = await readFromWorkerRoot(
      'src/server/services/cache.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/redirect-domain')).toBe(true);
  });
});

// ── MetricsService ───────────────────────────────────────────────────────────

describe('MetricsService shim parity', () => {
  it('API shim re-exports from @urlfy/cache', async () => {
    const source = await readFromApiRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Worker shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWorkerRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Web shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWebRoot(
      'src/server/services/metrics.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });
});

// ── AntiAbuseService ─────────────────────────────────────────────────────────

describe('AntiAbuseService shim parity', () => {
  it('API shim re-exports from @urlfy/cache', async () => {
    const source = await readFromApiRoot(
      'src/server/services/anti-abuse.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });

  it('Web shim re-exports from @urlfy/cache', async () => {
    const source = await readFromWebRoot(
      'src/server/services/anti-abuse.service.ts'
    );
    expect(isReExportShim(source, '@urlfy/cache')).toBe(true);
  });
});

// ── Email Runtime ────────────────────────────────────────────────────────────

describe('Email runtime shim parity', () => {
  for (const app of ['API', 'Web'] as const) {
    const read = app === 'API' ? readFromApiRoot : readFromWebRoot;

    it(`${app} emails/types.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/emails/types.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} emails/render.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/emails/render.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/lib/email.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/lib/email.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/lib/locale.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/lib/locale.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });

    it(`${app} server/services/email.service.ts re-exports from @urlfy/email`, async () => {
      const source = await read('src/server/services/email.service.ts');
      expect(isReExportShim(source, '@urlfy/email')).toBe(true);
    });
  }
});

// ── Alias Regex Parity ───────────────────────────────────────────────────────

describe('Alias regex parity', () => {
  it('links.schema.ts pattern uses shared alias policy', async () => {
    const schemaSrc = await readFromApiRoot(
      'src/server/modules/links/links.schema.ts'
    );

    expect(
      schemaSrc.includes("from '@urlfy/contracts/alias-policy'"),
      'links.schema.ts must import ALIAS_REGEX from the shared alias policy'
    ).toBe(true);
    expect(
      schemaSrc.includes('ALIAS_REGEX.source'),
      'links.schema.ts must use ALIAS_REGEX.source as the pattern property'
    ).toBe(true);
  });

  it('shortcode.service delegates alias format to shared alias policy', async () => {
    const serviceSrc = await readFromApiRoot(
      'src/server/modules/links/services/shortcode.service.ts'
    );

    expect(
      serviceSrc.includes("from '@urlfy/contracts/alias-policy'"),
      'shortcode.service.ts must import the shared alias policy'
    ).toBe(true);
    expect(serviceSrc.includes('return isAliasFormat(alias);')).toBe(true);
  });

  it('url-validator self-shortener logic uses shared alias path regexes', async () => {
    const src = await readFromApiRoot(
      'src/server/modules/links/services/url-validator.ts'
    );

    expect(src.includes('ALIAS_PATH_SEGMENT_REGEX')).toBe(true);
    expect(src.includes('ALIAS_REDIRECT_PATH_REGEX')).toBe(true);
    expect(src.includes("from '@urlfy/contracts/alias-policy'")).toBe(true);
  });

  it('proxy.ts short-code matcher uses shared alias pattern', async () => {
    const src = await readFromWebRoot('src/proxy.ts');

    expect(src.includes('ALIAS_PATTERN')).toBe(true);
    expect(src.includes("from '@urlfy/contracts/alias-policy'")).toBe(true);
    expect(src.includes('SHORT_CODE_PATH_REGEX')).toBe(true);
  });

  it('public by-code params use the shared alias bounds and regex', async () => {
    const src = await readFromApiRoot(
      'src/server/modules/links/links.schema.ts'
    );

    const aliasMinLengthUsages =
      src.match(/minLength: ALIAS_MIN_LENGTH/g) ?? [];
    const aliasMaxLengthUsages =
      src.match(/maxLength: ALIAS_MAX_LENGTH/g) ?? [];

    expect(aliasMinLengthUsages.length).toBeGreaterThanOrEqual(3);
    expect(aliasMaxLengthUsages.length).toBeGreaterThanOrEqual(3);
    expect(src.includes('pattern: ALIAS_REGEX.source')).toBe(true);
  });

  it('internal analytics shortCode payload uses the shared alias bounds and regex', async () => {
    const src = await readFromApiRoot(
      'src/server/modules/internal/internal.schema.ts'
    );

    expect(src.includes('ALIAS_MIN_LENGTH')).toBe(true);
    expect(src.includes('ALIAS_MAX_LENGTH')).toBe(true);
    expect(src.includes('pattern: ALIAS_REGEX.source')).toBe(true);
  });

  it('redirect-domain self-shortener loop logic uses shared alias regexes', async () => {
    const src = await readFromApiRoot(
      '../../packages/redirect-domain/src/service.ts'
    );

    expect(src.includes('ALIAS_PATH_SEGMENT_REGEX')).toBe(true);
    expect(src.includes('ALIAS_REDIRECT_PATH_REGEX')).toBe(true);
    expect(src.includes("from '@urlfy/contracts/alias-policy'")).toBe(true);
  });
});

describe('Common schema parity', () => {
  it('reuses response and alias primitives instead of redefining them', async () => {
    const src = await readFromApiRoot(
      'src/server/modules/common/common.schema.ts'
    );
    const normalized = src.replace(/\s+/g, ' ').trim();

    expect(
      normalized.includes("from '@/server/lib/response.schema'"),
      'common.schema.ts must import shared response schemas'
    ).toBe(true);
    expect(normalized.includes('ApiError')).toBe(true);
    expect(normalized.includes('PaginationMeta')).toBe(true);
    expect(
      normalized.includes("from '@urlfy/contracts/alias-policy'"),
      'common.schema.ts must import shared alias policy'
    ).toBe(true);
    expect(src.includes('pattern: ALIAS_REGEX.source')).toBe(true);
    expect(src.includes('export const PaginationMeta = t.Object(')).toBe(false);
    expect(src.includes('export const ApiError = t.Object(')).toBe(false);
  });
});

// ── Generated Contract Parity ────────────────────────────────────────────────

describe('Generated API contract parity', () => {
  const generatedContracts = [
    ['response.api-error', 'ApiError'],
    ['response.error', 'ApiErrorResponse'],
    ['response.pagination', 'PaginationMeta'],
    ['links.response', 'LinkResponse'],
    ['links.preview.response', 'LinkPreviewResponse'],
    ['links.stats.response', 'LinkStatsResponse'],
    ['links.dashboard.summary', 'DashboardSummaryResponse'],
    ['links.url.validate.response', 'UrlValidationResponse'],
    ['links.password.verify.response', 'VerifyPasswordResponse'],
    ['analytics.summary', 'AnalyticsSummary'],
    ['analytics.breakdown', 'AnalyticsBreakdown'],
    ['analytics.timeseries', 'AnalyticsTimeseries'],
    ['users.quota', 'UserQuotaResponse'],
    ['users.export', 'UserDataExportResponse'],
    ['users.deletion.response', 'DataDeletionRequestResponse'],
    ['api-keys.response', 'ApiKeyPublicResponse'],
    ['api-keys.created', 'ApiKeyCreatedResponse'],
    ['api-keys.list', 'ApiKeysListResponse'],
    ['admin.stats.response', 'AdminStatsResponse'],
    ['admin.link.response', 'AdminLinkResponse'],
    ['admin.user.response', 'AdminUserResponse'],
    ['admin.audit.response', 'AuditLogEntryResponse'],
    ['contact.admin.message', 'ContactMessage'],
    ['contact.list', 'ContactMessagesQuery'],
    ['contact.update', 'UpdateContactMessageRequest']
  ] as const;

  it('keeps generated public symbols backed by OpenAPI components', async () => {
    const [openApiText, generatedText] = await Promise.all([
      readFromWorkspaceRoot('openapi-spec.json'),
      readFromWorkspaceRoot('packages/contracts/src/generated/api.ts')
    ]);
    const spec = JSON.parse(openApiText) as {
      components?: { schemas?: Record<string, unknown> };
    };
    const schemas = spec.components?.schemas ?? {};

    for (const [componentName, typeName] of generatedContracts) {
      expect(
        schemas[componentName],
        `${componentName} must exist`
      ).toBeDefined();
      expect(
        generatedText.includes(` ${typeName} `),
        `${typeName} must be generated from ${componentName}`
      ).toBe(true);
    }
  });

  it('does not expose the removed shared contracts subpath', async () => {
    const packageJson = JSON.parse(
      await readFromWorkspaceRoot('packages/contracts/package.json')
    ) as { exports?: Record<string, string> };

    expect(packageJson.exports?.['./shared']).toBeUndefined();
    expect(
      await workspaceFile('packages/contracts/src/shared.ts').exists()
    ).toBe(false);
  });

  it('keeps api-client request payloads sourced from generated contracts', async () => {
    const [apiClientText, generatedClientText] = await Promise.all([
      readFromWorkspaceRoot('packages/contracts/src/api-client.ts'),
      readFromWorkspaceRoot('packages/contracts/src/generated/client.ts')
    ]);

    expect(
      apiClientText.includes("from './generated/client'"),
      'api-client must source its Eden routes from the generated client contract'
    ).toBe(true);
    expect(
      generatedClientText.includes("from './api'"),
      'generated Eden client must import public request and response types from generated/api'
    ).toBe(true);
    expect(apiClientText.includes('interface LinksRoutes')).toBe(false);
    expect(apiClientText.includes('interface AdminRoutes')).toBe(false);
    expect(generatedClientText.includes('CreateApiKeyRequest')).toBe(true);
    expect(generatedClientText.includes('LinkResponse')).toBe(true);
    expect(generatedClientText.includes('VerifyPasswordResponse')).toBe(true);
    expect(
      apiClientText.includes(
        'export type StreamStatsResponse = AdminQueueStreamStats;'
      )
    ).toBe(true);
    expect(
      apiClientText.includes(
        'export type ContactMessagesQuery = GeneratedContactMessagesQuery;'
      )
    ).toBe(true);
    expect(apiClientText.includes('page?: string;')).toBe(false);
    expect(apiClientText.includes('limit?: string;')).toBe(false);
    expect(apiClientText.includes("format?: 'png' | 'svg';")).toBe(false);
    expect(apiClientText.includes('export interface CreateApiKeyRequest')).toBe(
      false
    );
    expect(
      apiClientText.includes('export interface ContactMessageResponse')
    ).toBe(false);
  });

  it('keeps generated Eden routes checked into source control', async () => {
    expect(
      await workspaceFile('packages/contracts/src/generated/client.ts').exists()
    ).toBe(true);
  });

  it('keeps generated Eden routes free from unknown fallbacks', async () => {
    const generatedClientText = await readFromWorkspaceRoot(
      'packages/contracts/src/generated/client.ts'
    );

    expect(generatedClientText.includes('unknown')).toBe(false);
  });

  it('keeps paginated Eden routes typed as raw payload arrays and rehydrates meta in web helpers', async () => {
    const [generatedClientText, linksClientText, adminClientText] =
      await Promise.all([
        readFromWorkspaceRoot('packages/contracts/src/generated/client.ts'),
        readFromWorkspaceRoot('apps/web/src/lib/api/links.ts'),
        readFromWorkspaceRoot('apps/web/src/lib/api/admin.ts')
      ]);

    for (const signature of [
      'ApiClientResponse<LinkResponse[]>',
      'ApiClientResponse<AdminLinkResponse[]>',
      'ApiClientResponse<AdminUserResponse[]>',
      'ApiClientResponse<ContactMessage[]>',
      'ApiClientResponse<AuditLogEntryResponse[]>'
    ]) {
      expect(
        generatedClientText.includes(signature),
        `${signature} must stay raw because PaginationMeta lives on the success envelope`
      ).toBe(true);
    }

    for (const nestedSignature of [
      'ApiClientResponse<PaginatedResponse<LinkResponse>>',
      'ApiClientResponse<PaginatedResponse<AdminLinkResponse>>',
      'ApiClientResponse<PaginatedResponse<AdminUserResponse>>',
      'ApiClientResponse<ContactMessagesResponse>',
      'ApiClientResponse<PaginatedResponse<AuditLogEntryResponse>>'
    ]) {
      expect(
        generatedClientText.includes(nestedSignature),
        `${nestedSignature} would double-wrap paginated responses`
      ).toBe(false);
    }

    expect(
      linksClientText.includes(
        'handleEden<PaginatedResponse<LinkResponse>>(response)'
      )
    ).toBe(true);
    expect(
      adminClientText.includes(
        'handleEden<PaginatedResponse<AdminLinkRaw>>(response)'
      )
    ).toBe(true);
    expect(
      adminClientText.includes(
        'handleEden<PaginatedResponse<UserResponse>>(response)'
      )
    ).toBe(true);
    expect(
      adminClientText.includes(
        'handleEden<PaginatedResponse<AuditLogEntry>>(response)'
      )
    ).toBe(true);
    expect(
      adminClientText.includes('handleEden<ContactMessagesResponse>(response)')
    ).toBe(true);
  });
});
