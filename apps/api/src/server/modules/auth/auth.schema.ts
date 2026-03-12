/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH SCHEMA - Validation schemas for authentication endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Authentication & Identity
 * Pattern: TypeBox schemas as Single Source of Truth
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// API KEY SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const ApiKeyPermissions = t.Object({
  links: t.Optional(
    t.Object({
      read: t.Optional(t.Boolean()),
      create: t.Optional(t.Boolean()),
      update: t.Optional(t.Boolean()),
      delete: t.Optional(t.Boolean())
    })
  ),
  analytics: t.Optional(
    t.Object({
      read: t.Optional(t.Boolean())
    })
  )
});
export type ApiKeyPermissionsType = Static<typeof ApiKeyPermissions>;

export const ApiKeyCreateBody = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
    description: 'API key name for identification'
  }),
  permissions: t.Optional(ApiKeyPermissions),
  rateLimit: t.Optional(
    t.Number({
      minimum: 100,
      maximum: 10000,
      description: 'Rate limit requests per hour'
    })
  ),
  expiresInDays: t.Optional(
    t.Number({
      minimum: 1,
      maximum: 365,
      description: 'Expires after N days'
    })
  )
});
export type ApiKeyCreateBodyType = Static<typeof ApiKeyCreateBody>;

export const ApiKeyUpdateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  permissions: t.Optional(ApiKeyPermissions)
});
export type ApiKeyUpdateBodyType = Static<typeof ApiKeyUpdateBody>;

export const ApiKeyIdParam = t.Object({
  keyId: t.String({
    description: 'API key UUID',
    examples: ['550e8400-e29b-41d4-a716-446655440000']
  })
});
export type ApiKeyIdParamType = Static<typeof ApiKeyIdParam>;

export const ApiKeyResponse = t.Object(
  {
    id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    name: t.String({ examples: ['My Production Key'] }),
    keyPrefix: t.String({
      description: 'First 12 chars of key',
      examples: ['urlfy_sk_abc']
    }),
    permissions: ApiKeyPermissions,
    rateLimit: t.Number({ examples: [1000] }),
    lastUsedAt: t.Nullable(t.String({ examples: ['2026-01-06T12:00:00Z'] })),
    usageCount: t.Number({ examples: [42] }),
    expiresAt: t.Nullable(t.String({ examples: ['2027-01-06T00:00:00Z'] })),
    createdAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
  },
  {
    description: 'API key response (key value is never returned)',
    examples: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'My Production Key',
        keyPrefix: 'urlfy_sk_abc',
        permissions: {
          links: { read: true, create: true, update: true, delete: false },
          analytics: { read: true }
        },
        rateLimit: 1000,
        lastUsedAt: '2026-01-06T12:00:00Z',
        usageCount: 42,
        expiresAt: null,
        createdAt: '2026-01-06T10:00:00Z'
      }
    ]
  }
);
export type ApiKeyResponseType = Static<typeof ApiKeyResponse>;

export const ApiKeyCreateResponse = t.Object(
  {
    id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    name: t.String({ examples: ['My Production Key'] }),
    key: t.String({
      description: 'Full API key (only shown once)',
      examples: ['urlfy_sk_abc123xyz789...']
    }),
    keyPrefix: t.String({ examples: ['urlfy_sk_abc'] }),
    permissions: ApiKeyPermissions,
    rateLimit: t.Number({ examples: [1000] }),
    expiresAt: t.Nullable(t.String({ examples: ['2027-01-06T00:00:00Z'] })),
    createdAt: t.String({ examples: ['2026-01-06T12:00:00Z'] }),
    warning: t.Optional(
      t.String({
        description: 'Warning about key visibility',
        examples: ['⚠️ Save this key securely. It will not be shown again.']
      })
    )
  },
  {
    description:
      'API key creation response with the full key (shown only once)',
    examples: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'My Production Key',
        key: 'urlfy_sk_abc123xyz789def456...',
        keyPrefix: 'urlfy_sk_abc',
        permissions: {
          links: { read: true, create: true, update: true, delete: false },
          analytics: { read: true }
        },
        rateLimit: 1000,
        expiresAt: null,
        createdAt: '2026-01-06T12:00:00Z',
        warning: '⚠️ Save this key securely. It will not be shown again.'
      }
    ]
  }
);
export type ApiKeyCreateResponseType = Static<typeof ApiKeyCreateResponse>;

// ═══════════════════════════════════════════════════════════════════
// SESSION SCHEMAS (with examples for OpenAPI)
// ═══════════════════════════════════════════════════════════════════

export const SessionResponse = t.Object(
  {
    user: t.Nullable(
      t.Object({
        id: t.String({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
        email: t.String({ examples: ['user@example.com'] }),
        name: t.Nullable(t.String({ examples: ['John Doe'] })),
        emailVerified: t.Boolean({ examples: [true] }),
        image: t.Nullable(
          t.String({ examples: ['https://example.com/avatar.jpg'] })
        ),
        role: t.String({ examples: ['user'] }),
        linksQuota: t.Number({ examples: [100] }),
        linksCount: t.Number({ examples: [45] }),
        createdAt: t.String({ examples: ['2026-01-01T00:00:00Z'] }),
        updatedAt: t.String({ examples: ['2026-01-06T12:00:00Z'] })
      })
    ),
    session: t.Nullable(
      t.Object({
        id: t.String({ examples: ['sess_abc123'] }),
        expiresAt: t.String({ examples: ['2026-01-07T12:00:00Z'] }),
        ipAddress: t.Nullable(t.String({ examples: ['192.168.1.1'] })),
        userAgent: t.Nullable(
          t.String({
            examples: [
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            ]
          })
        )
      })
    )
  },
  {
    description: 'Current session with user details',
    examples: [
      {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          name: 'John Doe',
          emailVerified: true,
          image: null,
          role: 'user',
          linksQuota: 100,
          linksCount: 45,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-06T12:00:00Z'
        },
        session: {
          id: 'sess_abc123',
          expiresAt: '2026-01-07T12:00:00Z',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Chrome/120.0.0.0'
        }
      }
    ]
  }
);
export type SessionResponseType = Static<typeof SessionResponse>;

// ═══════════════════════════════════════════════════════════════════
// TWO-FACTOR SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const TwoFactorStatusResponse = t.Object(
  {
    enabled: t.Boolean({ examples: [true] }),
    verified: t.Boolean({ examples: [true] }),
    setupAt: t.Nullable(t.String({ examples: ['2026-01-01T00:00:00Z'] }))
  },
  {
    description: 'Two-factor authentication status',
    examples: [
      { enabled: true, verified: true, setupAt: '2026-01-01T00:00:00Z' }
    ]
  }
);
export type TwoFactorStatusResponseType = Static<
  typeof TwoFactorStatusResponse
>;

export const SessionIdParam = t.Object({
  sessionId: t.String({
    description: 'Session UUID',
    examples: ['sess_abc123']
  })
});
export type SessionIdParamType = Static<typeof SessionIdParam>;

export const SessionListResponse = t.Object(
  {
    id: t.String({ examples: ['sess_abc123'] }),
    isCurrent: t.Boolean({ examples: [true] }),
    ipAddress: t.Nullable(t.String({ examples: ['192.168.1.1'] })),
    userAgent: t.Nullable(
      t.String({ examples: ['Mozilla/5.0 Chrome/120.0.0.0'] })
    ),
    createdAt: t.String({ examples: ['2026-01-06T10:00:00Z'] }),
    expiresAt: t.String({ examples: ['2026-01-07T10:00:00Z'] })
  },
  {
    description: 'Session list item',
    examples: [
      {
        id: 'sess_abc123',
        isCurrent: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        createdAt: '2026-01-06T10:00:00Z',
        expiresAt: '2026-01-07T10:00:00Z'
      }
    ]
  }
);
export type SessionListResponseType = Static<typeof SessionListResponse>;

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for OpenAPI $ref support)
// ═══════════════════════════════════════════════════════════════════

export const AuthModel = new Elysia({ name: 'auth.model' }).model({
  'auth.api-key.permissions': ApiKeyPermissions,
  'auth.api-key.create': ApiKeyCreateBody,
  'auth.api-key.update': ApiKeyUpdateBody,
  'auth.api-key.param': ApiKeyIdParam,
  'auth.api-key.response': ApiKeyResponse,
  'auth.api-key.create.response': ApiKeyCreateResponse,
  'auth.session.response': SessionResponse,
  'auth.session.list.response': SessionListResponse,
  'auth.session.param': SessionIdParam,
  'auth.2fa.status.response': TwoFactorStatusResponse
});
