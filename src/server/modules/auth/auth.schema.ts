/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH SCHEMA - Validation schemas for authentication endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Authentication & Identity
 * Pattern: TypeBox schemas as Single Source of Truth
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { type Static, t } from 'elysia';

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
  keyId: t.String({ description: 'API key UUID' })
});
export type ApiKeyIdParamType = Static<typeof ApiKeyIdParam>;

export const ApiKeyResponse = t.Object({
  id: t.String(),
  name: t.String(),
  keyPrefix: t.String({ description: 'First 12 chars of key' }),
  permissions: ApiKeyPermissions,
  rateLimit: t.Number(),
  lastUsedAt: t.Nullable(t.String()),
  usageCount: t.Number(),
  expiresAt: t.Nullable(t.String()),
  createdAt: t.String()
});
export type ApiKeyResponseType = Static<typeof ApiKeyResponse>;

export const ApiKeyCreateResponse = t.Object({
  id: t.String(),
  name: t.String(),
  key: t.String({ description: 'Full API key (only shown once)' }),
  keyPrefix: t.String(),
  permissions: ApiKeyPermissions,
  rateLimit: t.Number(),
  expiresAt: t.Nullable(t.String()),
  createdAt: t.String()
});
export type ApiKeyCreateResponseType = Static<typeof ApiKeyCreateResponse>;

// ═══════════════════════════════════════════════════════════════════
// SESSION SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const SessionResponse = t.Object({
  user: t.Nullable(
    t.Object({
      id: t.String(),
      email: t.String(),
      name: t.Nullable(t.String()),
      emailVerified: t.Boolean(),
      image: t.Nullable(t.String()),
      role: t.String(),
      linksQuota: t.Number(),
      linksCount: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String()
    })
  ),
  session: t.Nullable(
    t.Object({
      id: t.String(),
      expiresAt: t.String(),
      ipAddress: t.Nullable(t.String()),
      userAgent: t.Nullable(t.String())
    })
  )
});
export type SessionResponseType = Static<typeof SessionResponse>;

// ═══════════════════════════════════════════════════════════════════
// TWO-FACTOR SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const TwoFactorStatusResponse = t.Object({
  enabled: t.Boolean(),
  verified: t.Boolean(),
  setupAt: t.Nullable(t.String())
});
export type TwoFactorStatusResponseType = Static<
  typeof TwoFactorStatusResponse
>;

export const SessionIdParam = t.Object({
  sessionId: t.String({ description: 'Session UUID' })
});
export type SessionIdParamType = Static<typeof SessionIdParam>;

export const SessionListResponse = t.Object({
  id: t.String(),
  isCurrent: t.Boolean(),
  ipAddress: t.Nullable(t.String()),
  userAgent: t.Nullable(t.String()),
  createdAt: t.String(),
  expiresAt: t.String()
});
export type SessionListResponseType = Static<typeof SessionListResponse>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY FOR INJECTION
// ═══════════════════════════════════════════════════════════════════

export const AuthModel = {
  ApiKeyPermissions,
  ApiKeyCreateBody,
  ApiKeyUpdateBody,
  ApiKeyIdParam,
  ApiKeyResponse,
  ApiKeyCreateResponse,
  SessionResponse,
  TwoFactorStatusResponse,
  SessionIdParam,
  SessionListResponse
};
