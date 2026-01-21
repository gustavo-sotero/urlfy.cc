/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS SCHEMA - Validation schemas for key management endpoints
 * ═══════════════════════════════════════════════════════════════════
 * Pattern: TypeBox schemas as Single Source of Truth
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, type Static, t } from 'elysia';
import { Scopes } from '@/server/config/scopes';

// ─── Scope Enum for Validation ────────────────────────────────────

const ScopeEnum = t.Union(
  Object.values(Scopes).map((s) => t.Literal(s)),
  { description: 'API permission scope' }
);

// ─── Rate Limit Config ────────────────────────────────────────────

const RateLimitConfig = t.Object({
  enabled: t.Boolean({ default: true }),
  max: t.Integer({ minimum: 1, maximum: 10000, default: 1000 }),
  windowMs: t.Integer({
    minimum: 1000,
    maximum: 86400000,
    default: 3600000,
    description: 'Time window in milliseconds (default: 1 hour)'
  })
});

// ─── Create API Key ───────────────────────────────────────────────

export const CreateApiKeyBody = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
    description: 'Friendly name for the API key',
    examples: ['Production Server', 'CI/CD Pipeline']
  }),
  scopes: t.Array(ScopeEnum, {
    minItems: 1,
    maxItems: 20,
    description: 'Permissions granted to this key',
    examples: [['links:read', 'links:write']]
  }),
  expiresAt: t.Optional(
    t.String({
      format: 'date-time',
      description: 'Expiration date (ISO 8601). Null for no expiration.'
    })
  ),
  rateLimit: t.Optional(RateLimitConfig)
});

export type CreateApiKeyBodyType = Static<typeof CreateApiKeyBody>;

// ─── API Key Response ─────────────────────────────────────────────

export const ApiKeyResponse = t.Object({
  id: t.String(),
  name: t.Union([t.String(), t.Null()]),
  prefix: t.Union([t.String(), t.Null()]),
  scopes: t.Array(ScopeEnum),
  createdAt: t.String({ format: 'date-time' }),
  lastUsedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
  expiresAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
  usageCount: t.Integer(),
  rateLimit: t.Object({
    enabled: t.Boolean(),
    max: t.Integer(),
    windowMs: t.Integer()
  }),
  status: t.Union([
    t.Literal('active'),
    t.Literal('expired'),
    t.Literal('revoked'),
    t.Literal('quota_exceeded')
  ])
});

export type ApiKeyResponseType = Static<typeof ApiKeyResponse>;

// ─── Created Key Response (with raw key) ──────────────────────────

export const ApiKeyCreatedResponse = t.Intersect([
  ApiKeyResponse,
  t.Object({
    key: t.String({
      description:
        'Full API key. Save this securely - it will not be shown again!'
    })
  })
]);

export type ApiKeyCreatedResponseType = Static<typeof ApiKeyCreatedResponse>;

// ─── List Keys Response ───────────────────────────────────────────

export const ApiKeyListResponse = t.Object({
  keys: t.Array(ApiKeyResponse),
  total: t.Integer()
});

// ─── Revoke Key Body ──────────────────────────────────────────────

export const RevokeApiKeyBody = t.Object({
  reason: t.Optional(
    t.String({
      maxLength: 255,
      description: 'Optional reason for revocation'
    })
  )
});

// ─── Model Registration ───────────────────────────────────────────

export const ApiKeysModel = new Elysia({ name: 'Model.ApiKeys' }).model({
  'apikeys.create': CreateApiKeyBody,
  'apikeys.response': ApiKeyResponse,
  'apikeys.created': ApiKeyCreatedResponse,
  'apikeys.list': ApiKeyListResponse,
  'apikeys.revoke': RevokeApiKeyBody
});
