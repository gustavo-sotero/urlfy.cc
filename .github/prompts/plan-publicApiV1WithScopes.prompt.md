# Implementation Plan: Public API V1 with Scoped API Keys

> **Module**: Public API  
> **Version**: 1.0.0  
> **Status**: Planning  
> **Dependencies**: Better-Auth (apiKey plugin), Drizzle ORM, Elysia

---

## 1. Overview

This plan establishes a **versioned Public API (`/api/v1`)** for programmatic access to urlfy.cc. It introduces:

- **Granular Scopes**: Fine-grained permissions per API key.
- **Quota Enforcement**: Hard limits with `429 Too Many Requests` when exceeded.
- **Key Management**: User-facing endpoints to create, list, revoke, and monitor keys.
- **Isolated Versioning**: `v1` routes are separate from internal dashboard API for contract stability.

---

## 2. Scope System Design

### 2.1 Scope Taxonomy

Scopes follow the pattern `{resource}:{action}` for consistency and predictability.

| Scope             | Description                                   | Category  |
| ----------------- | --------------------------------------------- | --------- |
| `links:read`      | View link details, list own links             | Core      |
| `links:write`     | Create, update, delete links                  | Core      |
| `analytics:read`  | Access click analytics and statistics         | Core      |
| `qr:generate`     | Generate QR codes for links                   | Extension |
| `bulk:write`      | Access bulk creation endpoint (`/links/bulk`) | Extension |
| `domains:manage`  | Manage custom domains (future)                | Future    |
| `webhooks:manage` | Configure webhook subscriptions (future)      | Future    |
| `account:read`    | Read own account/quota info                   | Account   |

### 2.2 File: `src/server/config/scopes.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY SCOPES - Permission definitions for Public API
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * All available API scopes.
 * Pattern: {resource}:{action}
 */
export const Scopes = {
  // ─── Core Link Operations ───────────────────────────────────────
  LINKS_READ: 'links:read',
  LINKS_WRITE: 'links:write',

  // ─── Analytics ──────────────────────────────────────────────────
  ANALYTICS_READ: 'analytics:read',

  // ─── Extensions ─────────────────────────────────────────────────
  QR_GENERATE: 'qr:generate',
  BULK_WRITE: 'bulk:write',

  // ─── Account ────────────────────────────────────────────────────
  ACCOUNT_READ: 'account:read'
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

/**
 * Scope metadata for UI display and documentation.
 */
export const ScopeMetadata: Record<
  Scope,
  {
    label: string;
    description: string;
    category: 'core' | 'extension' | 'account' | 'future';
    dangerous?: boolean;
  }
> = {
  [Scopes.LINKS_READ]: {
    label: 'Read Links',
    description: 'View link details and list your links',
    category: 'core'
  },
  [Scopes.LINKS_WRITE]: {
    label: 'Write Links',
    description: 'Create, update, and delete links',
    category: 'core'
  },
  [Scopes.ANALYTICS_READ]: {
    label: 'Read Analytics',
    description: 'Access click statistics and analytics data',
    category: 'core'
  },
  [Scopes.QR_GENERATE]: {
    label: 'Generate QR Codes',
    description: 'Generate QR code images for links',
    category: 'extension'
  },
  [Scopes.BULK_WRITE]: {
    label: 'Bulk Operations',
    description: 'Create multiple links in a single request',
    category: 'extension',
    dangerous: true
  },
  [Scopes.ACCOUNT_READ]: {
    label: 'Read Account',
    description: 'View your account information and quota usage',
    category: 'account'
  }
};

/**
 * Preset scope bundles for common use cases.
 */
export const ScopePresets = {
  /** Read-only access to links and analytics */
  READONLY: [Scopes.LINKS_READ, Scopes.ANALYTICS_READ, Scopes.ACCOUNT_READ],

  /** Standard CRUD operations */
  STANDARD: [
    Scopes.LINKS_READ,
    Scopes.LINKS_WRITE,
    Scopes.ANALYTICS_READ,
    Scopes.ACCOUNT_READ
  ],

  /** Full access including extensions */
  FULL: Object.values(Scopes)
} as const;

/**
 * Type-safe scope validation.
 */
export function isValidScope(scope: string): scope is Scope {
  return Object.values(Scopes).includes(scope as Scope);
}

/**
 * Parse and validate scope array from DB (stored as JSON string).
 */
export function parseScopes(permissionsJson: string | null): Scope[] {
  if (!permissionsJson) return [];

  try {
    const parsed = JSON.parse(permissionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidScope);
  } catch {
    return [];
  }
}

/**
 * Serialize scopes for DB storage.
 */
export function serializeScopes(scopes: Scope[]): string {
  return JSON.stringify(scopes);
}

/**
 * Check if a scope set includes all required scopes.
 */
export function hasScopes(
  keyScopes: Scope[],
  requiredScopes: Scope[]
): boolean {
  return requiredScopes.every((scope) => keyScopes.includes(scope));
}
```

---

## 3. Types & Schemas

### 3.1 File: `src/types/api-keys.types.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY TYPES - Type definitions for key management
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Scope } from '@/server/config/scopes';
import type { ApiKey as DbApiKey } from '@/db/schema/auth';

/**
 * API Key as returned to the user (sensitive fields omitted).
 */
export interface ApiKeyPublic {
  id: string;
  name: string | null;
  prefix: string | null;
  scopes: Scope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  usageCount: number;
  rateLimit: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
  status: 'active' | 'expired' | 'revoked' | 'quota_exceeded';
}

/**
 * Full API Key returned only on creation (includes the raw key).
 */
export interface ApiKeyCreated extends ApiKeyPublic {
  /** The full API key. Only shown once! */
  key: string;
}

/**
 * Input for creating a new API key.
 */
export interface CreateApiKeyInput {
  name: string;
  scopes: Scope[];
  expiresAt?: Date | null;
  rateLimit?: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };
}

/**
 * Context injected by the API Key middleware.
 */
export interface ApiKeyContext {
  apiKey: {
    id: string;
    userId: string;
    scopes: Scope[];
    remaining: number;
  };
}

/**
 * Result of API key validation.
 */
export type ApiKeyValidationResult =
  | { valid: true; key: DbApiKey; scopes: Scope[] }
  | { valid: false; error: ApiKeyError };

export type ApiKeyError =
  | 'MISSING_KEY'
  | 'INVALID_KEY'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED'
  | 'QUOTA_EXCEEDED'
  | 'SCOPE_DENIED'
  | 'RATE_LIMITED';
```

### 3.2 File: `src/server/modules/api-keys/api-keys.schema.ts`

```typescript
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
        'The full API key. Store securely - it will not be shown again!'
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
```

---

## 4. API Key Middleware (Elysia Macro)

### 4.1 File: `src/server/middleware/api-key.macro.ts`

This macro provides reusable authentication and authorization for all `v1` endpoints.

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEY MACRO - Elysia macro for Public API authentication
 * ═══════════════════════════════════════════════════════════════════
 * Usage:
 *   .get('/endpoint', handler, { apiKey: { scopes: ['links:read'] } })
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { db } from '@/db';
import { apikey } from '@/db/schema/auth';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { type Scope, parseScopes, hasScopes } from '@/server/config/scopes';
import type { ApiKeyContext, ApiKeyError } from '@/types/api-keys.types';
import { redis } from '@/server/lib/redis';

// ─── Error Responses ──────────────────────────────────────────────

const ErrorResponses: Record<ApiKeyError, { status: number; message: string }> =
  {
    MISSING_KEY: {
      status: 401,
      message: 'API key required. Provide via x-api-key header.'
    },
    INVALID_KEY: { status: 401, message: 'Invalid API key.' },
    KEY_EXPIRED: { status: 401, message: 'API key has expired.' },
    KEY_REVOKED: { status: 401, message: 'API key has been revoked.' },
    QUOTA_EXCEEDED: {
      status: 429,
      message: 'API key quota exceeded. Please upgrade or wait for reset.'
    },
    SCOPE_DENIED: {
      status: 403,
      message: 'Insufficient permissions. Required scope not granted.'
    },
    RATE_LIMITED: {
      status: 429,
      message: 'Rate limit exceeded. Please slow down.'
    }
  };

function errorResponse(error: ApiKeyError, requiredScopes?: Scope[]) {
  const { status, message } = ErrorResponses[error];
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: error,
        message,
        ...(requiredScopes && { requiredScopes })
      }
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ─── Redis Rate Limit Check ───────────────────────────────────────

async function checkRateLimit(
  keyId: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `rl:apikey:${keyId}:${Math.floor(now / windowMs)}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.pexpire(windowKey, windowMs);
  }

  const remaining = Math.max(0, max - count);
  const resetAt = Math.ceil(now / windowMs) * windowMs;

  return {
    allowed: count <= max,
    remaining,
    resetAt
  };
}

// ─── Async Usage Increment ────────────────────────────────────────

async function incrementUsage(keyId: string): Promise<void> {
  try {
    await db
      .update(apikey)
      .set({
        usageCount: sql`${apikey.usageCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(apikey.id, keyId));
  } catch (error) {
    // Fire-and-forget: log but don't block request
    console.error('[API Key] Failed to increment usage:', error);
  }
}

// ─── Main Macro ───────────────────────────────────────────────────

interface ApiKeyMacroOptions {
  /** Required scopes for this endpoint */
  scopes: Scope[];
  /** Skip quota check (for read-heavy endpoints) */
  skipQuotaIncrement?: boolean;
}

export const apiKeyMacro = new Elysia({ name: 'Macro.ApiKey' }).macro({
  apiKey: (options: ApiKeyMacroOptions) => ({
    async beforeHandle({ request, set }) {
      const { scopes: requiredScopes, skipQuotaIncrement = false } = options;

      // ─── 1. Extract Key ─────────────────────────────────────
      const keyHeader = request.headers.get('x-api-key');
      if (!keyHeader) {
        return errorResponse('MISSING_KEY');
      }

      // ─── 2. Lookup Key in DB ────────────────────────────────
      const keyRecord = await db.query.apikey.findFirst({
        where: and(
          eq(apikey.key, keyHeader),
          isNull(apikey.deletedAt),
          isNull(apikey.revokedAt)
        )
      });

      if (!keyRecord) {
        return errorResponse('INVALID_KEY');
      }

      // ─── 3. Check Expiration ────────────────────────────────
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        return errorResponse('KEY_EXPIRED');
      }

      // ─── 4. Check Rate Limit (Redis) ────────────────────────
      if (keyRecord.rateLimitEnabled && keyRecord.rateLimitMax) {
        const rateResult = await checkRateLimit(
          keyRecord.id,
          keyRecord.rateLimitMax,
          keyRecord.rateLimitTimeWindow ?? 3600000
        );

        // Set rate limit headers
        set.headers['X-RateLimit-Limit'] = String(keyRecord.rateLimitMax);
        set.headers['X-RateLimit-Remaining'] = String(rateResult.remaining);
        set.headers['X-RateLimit-Reset'] = String(rateResult.resetAt);

        if (!rateResult.allowed) {
          return errorResponse('RATE_LIMITED');
        }
      }

      // ─── 5. Check Quota ─────────────────────────────────────
      // Use 'remaining' field if set, otherwise check usageCount vs limit
      const quotaLimit = keyRecord.remaining ?? keyRecord.rateLimitMax ?? 1000;
      if (keyRecord.usageCount && keyRecord.usageCount >= quotaLimit) {
        return errorResponse('QUOTA_EXCEEDED');
      }

      // ─── 6. Check Scopes ────────────────────────────────────
      const keyScopes = parseScopes(keyRecord.permissions);
      if (!hasScopes(keyScopes, requiredScopes)) {
        return errorResponse('SCOPE_DENIED', requiredScopes);
      }

      // ─── 7. Increment Usage (fire-and-forget) ───────────────
      if (!skipQuotaIncrement) {
        incrementUsage(keyRecord.id);
      }

      // ─── 8. Inject Context ──────────────────────────────────
      return {
        apiKey: {
          id: keyRecord.id,
          userId: keyRecord.userId,
          scopes: keyScopes,
          remaining: quotaLimit - (keyRecord.usageCount ?? 0) - 1
        } satisfies ApiKeyContext['apiKey']
      };
    }
  })
});
```

---

## 5. API Key Management Service

### 5.1 File: `src/server/modules/api-keys/api-keys.service.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS SERVICE - Business logic for key management
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from '@/db';
import { apikey } from '@/db/schema/auth';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  type Scope,
  serializeScopes,
  parseScopes
} from '@/server/config/scopes';
import type {
  ApiKeyPublic,
  ApiKeyCreated,
  CreateApiKeyInput
} from '@/types/api-keys.types';

// ─── Key Generation ───────────────────────────────────────────────

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = 'urlfy_sk'; // sk = secret key
  const secret = nanoid(32); // 32 char random string
  const key = `${prefix}_${secret}`;

  // Hash for secure storage lookup (optional, depends on your security model)
  const hash = Bun.hash(key).toString(16);

  return { key, prefix, hash };
}

// ─── Status Determination ─────────────────────────────────────────

function determineKeyStatus(
  key: typeof apikey.$inferSelect
): ApiKeyPublic['status'] {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && key.expiresAt < new Date()) return 'expired';

  const limit = key.remaining ?? key.rateLimitMax ?? 1000;
  if (key.usageCount && key.usageCount >= limit) return 'quota_exceeded';

  return 'active';
}

// ─── Transform DB Record to Public ────────────────────────────────

function toPublic(key: typeof apikey.$inferSelect): ApiKeyPublic {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix ?? key.keyPrefix,
    scopes: parseScopes(key.permissions),
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    usageCount: key.usageCount ?? 0,
    rateLimit: {
      enabled: key.rateLimitEnabled ?? true,
      max: key.rateLimitMax ?? 1000,
      windowMs: key.rateLimitTimeWindow ?? 3600000
    },
    status: determineKeyStatus(key)
  };
}

// ─── Service Class ────────────────────────────────────────────────

export abstract class ApiKeysService {
  /**
   * List all API keys for a user.
   */
  static async listByUser(userId: string): Promise<ApiKeyPublic[]> {
    const keys = await db.query.apikey.findMany({
      where: and(eq(apikey.userId, userId), isNull(apikey.deletedAt)),
      orderBy: [desc(apikey.createdAt)]
    });

    return keys.map(toPublic);
  }

  /**
   * Get a single API key by ID (must belong to user).
   */
  static async getById(
    keyId: string,
    userId: string
  ): Promise<ApiKeyPublic | null> {
    const key = await db.query.apikey.findFirst({
      where: and(
        eq(apikey.id, keyId),
        eq(apikey.userId, userId),
        isNull(apikey.deletedAt)
      )
    });

    return key ? toPublic(key) : null;
  }

  /**
   * Create a new API key.
   * Returns the full key (only shown once).
   */
  static async create(
    userId: string,
    input: CreateApiKeyInput
  ): Promise<ApiKeyCreated> {
    const { key, prefix, hash } = generateApiKey();
    const id = nanoid();

    const [created] = await db
      .insert(apikey)
      .values({
        id,
        userId,
        name: input.name,
        key, // Store full key (or just hash for extra security)
        keyHash: hash,
        prefix,
        keyPrefix: prefix,
        permissions: serializeScopes(input.scopes),
        expiresAt: input.expiresAt ?? null,
        rateLimitEnabled: input.rateLimit?.enabled ?? true,
        rateLimitMax: input.rateLimit?.max ?? 1000,
        rateLimitTimeWindow: input.rateLimit?.windowMs ?? 3600000,
        usageCount: 0,
        enabled: true
      })
      .returning();

    return {
      ...toPublic(created),
      key // Include raw key in response
    };
  }

  /**
   * Revoke an API key (soft delete).
   */
  static async revoke(
    keyId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const result = await db
      .update(apikey)
      .set({
        revokedAt: new Date(),
        // Store reason in metadata if provided
        metadata: reason ? JSON.stringify({ revokeReason: reason }) : undefined
      })
      .where(
        and(
          eq(apikey.id, keyId),
          eq(apikey.userId, userId),
          isNull(apikey.revokedAt)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Permanently delete an API key.
   */
  static async delete(keyId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(apikey)
      .set({ deletedAt: new Date() })
      .where(and(eq(apikey.id, keyId), eq(apikey.userId, userId)));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Rollover: Create new key and revoke old one atomically.
   */
  static async rollover(
    keyId: string,
    userId: string
  ): Promise<ApiKeyCreated | null> {
    const existing = await db.query.apikey.findFirst({
      where: and(
        eq(apikey.id, keyId),
        eq(apikey.userId, userId),
        isNull(apikey.deletedAt)
      )
    });

    if (!existing) return null;

    // Create new key with same settings
    const newKey = await this.create(userId, {
      name: `${existing.name} (rolled over)`,
      scopes: parseScopes(existing.permissions),
      expiresAt: existing.expiresAt,
      rateLimit: {
        enabled: existing.rateLimitEnabled ?? true,
        max: existing.rateLimitMax ?? 1000,
        windowMs: existing.rateLimitTimeWindow ?? 3600000
      }
    });

    // Revoke old key
    await this.revoke(keyId, userId, 'Rolled over to new key');

    return newKey;
  }
}
```

---

## 6. API Key Management Controller

### 6.1 File: `src/server/modules/api-keys/api-keys.controller.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS CONTROLLER - Endpoints for key management
 * ═══════════════════════════════════════════════════════════════════
 * Prefix: /api/keys
 * Auth: Session required (dashboard access)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { ApiKeysModel } from './api-keys.schema';
import { ApiKeysService } from './api-keys.service';
import { requireAuth } from '@/server/middleware/auth.middleware';

export const apiKeysController = new Elysia({
  prefix: '/keys',
  detail: {
    tags: ['API Keys Management'],
    description: 'Manage API keys for programmatic access'
  }
})
  .use(ApiKeysModel)
  .use(requireAuth) // Injects `user` into context

  // ─── List Keys ──────────────────────────────────────────────────
  .get(
    '/',
    async ({ user }) => {
      const keys = await ApiKeysService.listByUser(user.id);
      return {
        success: true,
        data: {
          keys,
          total: keys.length
        }
      };
    },
    {
      response: 'apikeys.list',
      detail: {
        summary: 'List API Keys',
        description: 'Retrieve all API keys for the authenticated user.'
      }
    }
  )

  // ─── Get Single Key ─────────────────────────────────────────────
  .get(
    '/:id',
    async ({ user, params, set }) => {
      const key = await ApiKeysService.getById(params.id, user.id);

      if (!key) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: 'API key not found' }
        };
      }

      return { success: true, data: key };
    },
    {
      params: t.Object({ id: t.String() }),
      response: 'apikeys.response',
      detail: {
        summary: 'Get API Key',
        description: 'Retrieve details of a specific API key.'
      }
    }
  )

  // ─── Create Key ─────────────────────────────────────────────────
  .post(
    '/',
    async ({ user, body }) => {
      const key = await ApiKeysService.create(user.id, {
        name: body.name,
        scopes: body.scopes,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        rateLimit: body.rateLimit
      });

      return { success: true, data: key };
    },
    {
      body: 'apikeys.create',
      response: 'apikeys.created',
      detail: {
        summary: 'Create API Key',
        description: `
          Generate a new API key with specified permissions.
          
          **⚠️ Important:** The full key is only shown once in this response.
          Store it securely!
        `
      }
    }
  )

  // ─── Revoke Key ─────────────────────────────────────────────────
  .post(
    '/:id/revoke',
    async ({ user, params, body, set }) => {
      const revoked = await ApiKeysService.revoke(
        params.id,
        user.id,
        body?.reason
      );

      if (!revoked) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: 'KEY_NOT_FOUND',
            message: 'API key not found or already revoked'
          }
        };
      }

      return {
        success: true,
        data: { message: 'API key revoked successfully' }
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: 'apikeys.revoke',
      detail: {
        summary: 'Revoke API Key',
        description:
          'Permanently revoke an API key. This action cannot be undone.'
      }
    }
  )

  // ─── Rollover Key ───────────────────────────────────────────────
  .post(
    '/:id/rollover',
    async ({ user, params, set }) => {
      const newKey = await ApiKeysService.rollover(params.id, user.id);

      if (!newKey) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: 'API key not found' }
        };
      }

      return { success: true, data: newKey };
    },
    {
      params: t.Object({ id: t.String() }),
      response: 'apikeys.created',
      detail: {
        summary: 'Rollover API Key',
        description: `
          Generate a new key with the same settings and revoke the old one.
          Use this when you suspect a key has been compromised.
        `
      }
    }
  )

  // ─── Delete Key (Hard) ──────────────────────────────────────────
  .delete(
    '/:id',
    async ({ user, params, set }) => {
      const deleted = await ApiKeysService.delete(params.id, user.id);

      if (!deleted) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: 'API key not found' }
        };
      }

      set.status = 204;
      return null;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Delete API Key',
        description: 'Permanently delete an API key.'
      }
    }
  );
```

### 6.2 File: `src/server/modules/api-keys/index.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * API KEYS MODULE - Export barrel
 * ═══════════════════════════════════════════════════════════════════
 */

export { apiKeysController } from './api-keys.controller';
export { ApiKeysService } from './api-keys.service';
export * from './api-keys.schema';
```

---

## 7. Public API V1 Router

### 7.1 File: `src/server/api/v1/index.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - Versioned API for external clients
 * ═══════════════════════════════════════════════════════════════════
 *
 * This router is separate from the internal dashboard API to ensure:
 * - Stable contracts for external consumers
 * - Independent versioning (v1, v2, etc.)
 * - Clear documentation for public endpoints
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { apiKeyMacro } from '@/server/middleware/api-key.macro';
import { v1LinksController } from '@/server/modules/public/v1-links.controller';

export const publicApiV1 = new Elysia({
  prefix: '/v1',
  detail: {
    tags: ['Public API v1'],
    security: [{ apiKey: [] }]
  }
})
  // Register the API key macro
  .use(apiKeyMacro)

  // Mount public controllers
  .use(v1LinksController);
```

### 7.2 File: `src/server/modules/public/v1-links.controller.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - Links Controller
 * ═══════════════════════════════════════════════════════════════════
 * Endpoints for programmatic link management via API keys.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { Scopes } from '@/server/config/scopes';
import { LinksService } from '@/server/modules/links/links.service';
import { LinksModel } from '@/server/modules/links';

export const v1LinksController = new Elysia({
  prefix: '/links',
  detail: {
    tags: ['Public API v1 - Links'],
    description: 'Create and manage shortened URLs via API'
  }
})
  .use(LinksModel)

  // ─── Shorten URL ────────────────────────────────────────────────
  .post(
    '/shorten',
    async ({ body, apiKey }) => {
      const link = await LinksService.create({
        userId: apiKey.userId,
        originalUrl: body.url,
        customAlias: body.customAlias,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        redirectType: body.redirectType ?? 302
      });

      return {
        success: true,
        data: {
          id: link.id,
          shortCode: link.shortCode,
          shortUrl: `https://urlfy.cc/${link.shortCode}`,
          originalUrl: link.originalUrl,
          createdAt: link.createdAt.toISOString(),
          expiresAt: link.expiresAt?.toISOString() ?? null
        }
      };
    },
    {
      apiKey: { scopes: [Scopes.LINKS_WRITE] },
      body: t.Object({
        url: t.String({
          format: 'uri',
          maxLength: 2048,
          description: 'The URL to shorten',
          examples: ['https://example.com/very-long-url']
        }),
        customAlias: t.Optional(
          t.String({
            minLength: 3,
            maxLength: 20,
            pattern: '^[a-zA-Z0-9-_]+$',
            description: 'Custom short code (alphanumeric, dash, underscore)'
          })
        ),
        expiresAt: t.Optional(
          t.String({
            format: 'date-time',
            description: 'Link expiration (ISO 8601)'
          })
        ),
        redirectType: t.Optional(
          t.Union([t.Literal(301), t.Literal(302)], { default: 302 })
        )
      }),
      detail: {
        summary: 'Shorten URL',
        description: `
          Create a shortened URL.
          
          **Required Scope:** \`links:write\`
        `
      }
    }
  )

  // ─── Get Link ───────────────────────────────────────────────────
  .get(
    '/:id',
    async ({ params, apiKey, set }) => {
      const link = await LinksService.getById(params.id, apiKey.userId);

      if (!link) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'LINK_NOT_FOUND', message: 'Link not found' }
        };
      }

      return { success: true, data: link };
    },
    {
      apiKey: { scopes: [Scopes.LINKS_READ] },
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Get Link',
        description: `
          Retrieve details of a specific link.
          
          **Required Scope:** \`links:read\`
        `
      }
    }
  )

  // ─── List Links ─────────────────────────────────────────────────
  .get(
    '/',
    async ({ query, apiKey }) => {
      const result = await LinksService.listByUser(apiKey.userId, {
        page: query.page ?? 1,
        perPage: query.perPage ?? 20,
        sort: query.sort ?? 'createdAt',
        order: query.order ?? 'desc'
      });

      return { success: true, ...result };
    },
    {
      apiKey: { scopes: [Scopes.LINKS_READ], skipQuotaIncrement: true },
      query: t.Object({
        page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
        perPage: t.Optional(
          t.Integer({ minimum: 1, maximum: 100, default: 20 })
        ),
        sort: t.Optional(t.String({ default: 'createdAt' })),
        order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')]))
      }),
      detail: {
        summary: 'List Links',
        description: `
          List all links for the authenticated user.
          
          **Required Scope:** \`links:read\`
          
          **Note:** This endpoint does not consume quota.
        `
      }
    }
  )

  // ─── Delete Link ────────────────────────────────────────────────
  .delete(
    '/:id',
    async ({ params, apiKey, set }) => {
      const deleted = await LinksService.softDelete(params.id, apiKey.userId);

      if (!deleted) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'LINK_NOT_FOUND', message: 'Link not found' }
        };
      }

      set.status = 204;
      return null;
    },
    {
      apiKey: { scopes: [Scopes.LINKS_WRITE] },
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Delete Link',
        description: `
          Soft-delete a link (recoverable for 30 days).
          
          **Required Scope:** \`links:write\`
        `
      }
    }
  )

  // ─── Get Link Stats ─────────────────────────────────────────────
  .get(
    '/:id/stats',
    async ({ params, apiKey, set }) => {
      const stats = await LinksService.getStats(params.id, apiKey.userId);

      if (!stats) {
        set.status = 404;
        return {
          success: false,
          error: { code: 'LINK_NOT_FOUND', message: 'Link not found' }
        };
      }

      return { success: true, data: stats };
    },
    {
      apiKey: { scopes: [Scopes.ANALYTICS_READ] },
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Get Link Statistics',
        description: `
          Get click statistics for a specific link.
          
          **Required Scope:** \`analytics:read\`
        `
      }
    }
  );
```

---

## 8. Integration with Main API

### 8.1 Update: `src/server/api/index.ts`

Add the following registrations to the main API file:

```typescript
// Add imports
import { ApiKeysModel, apiKeysController } from '@/server/modules/api-keys';
import { publicApiV1 } from '@/server/api/v1';

// Register in the api Elysia instance:
export const api = new Elysia({ prefix: '/api' })
  // ... existing model registrations ...
  .use(ApiKeysModel)

  // ... existing controllers ...
  .use(apiKeysController) // /api/keys/*

  // Public API v1
  .use(publicApiV1) // /api/v1/*

  // Update OpenAPI security schemes
  .use(
    openapi({
      documentation: {
        // ... existing config ...
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
              description:
                'API key for programmatic access. Obtain from dashboard.'
            },
            session: {
              type: 'apiKey',
              in: 'cookie',
              name: 'session',
              description: 'Session cookie (browser only)'
            }
          }
        }
      }
    })
  );
```

---

## 9. Directory Structure (Final)

```
src/server/
├── config/
│   └── scopes.ts                    # Scope definitions & utilities
├── middleware/
│   ├── api-key.macro.ts             # Elysia macro for API key auth
│   └── ... (existing)
├── modules/
│   ├── api-keys/
│   │   ├── index.ts                 # Module exports
│   │   ├── api-keys.controller.ts   # Key management endpoints
│   │   ├── api-keys.service.ts      # Business logic
│   │   └── api-keys.schema.ts       # TypeBox validation schemas
│   ├── public/
│   │   └── v1-links.controller.ts   # Public API v1 link endpoints
│   └── ... (existing: links, auth, etc.)
├── api/
│   ├── index.ts                     # Main API (updated)
│   └── v1/
│       └── index.ts                 # Public API v1 router
└── ...
```

---

## 10. Testing Checklist

### Unit Tests

- [ ] `scopes.ts`: `parseScopes`, `hasScopes`, `isValidScope`
- [ ] `api-keys.service.ts`: `create`, `revoke`, `rollover`
- [ ] `api-key.macro.ts`: All error conditions

### Integration Tests

- [ ] Create key with specific scopes → use key → verify access
- [ ] Create key → exhaust quota → verify `429`
- [ ] Create key → revoke → verify `401`
- [ ] Create key without required scope → verify `403`
- [ ] Rate limit enforcement (Redis)

### E2E Tests

- [ ] Full flow: Dashboard create key → API create link → verify link works
- [ ] Rollover flow preserves link access

---

## 11. Documentation Deliverables

1. **OpenAPI/Swagger**: Auto-generated at `/api/docs` via Elysia plugin
2. **Developer Guide**: `docs/api/public-api.md` explaining:
   - How to obtain API keys
   - Scope reference table
   - Rate limit behavior
   - Error code reference
3. **Changelog**: Update `CHANGELOG.md` with v1 API release notes

---

## 12. Future Scope Roadmap

| Phase | Scopes                         | Features                            |
| ----- | ------------------------------ | ----------------------------------- |
| MVP   | `links:*`, `analytics:read`    | Core link & stats                   |
| 1.1   | `bulk:write`, `qr:generate`    | Batch ops, QR codes                 |
| 1.2   | `account:read`                 | Self-service quota monitoring       |
| 2.0   | `domains:manage`, `webhooks:*` | Custom domains, event subscriptions |

---

_End of Plan_
