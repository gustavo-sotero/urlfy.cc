# Codebase Remediation Plan - urlfy.cc

**Based on:** CODEBASE_ANALYSIS_2026-01-28.md  
**Total Issues:** 34 (2 Critical, 5 High, 12 Medium, 15 Low)  
**Estimated Effort:** 4 Sprints (~1 month)

---

## Sprint 1: Critical Security Issues (Immediate - 2 days)

### C-1: Implement Nonce-Based CSP to Remove `unsafe-inline`

**Location:** `src/server/config/security.ts`  
**Risk:** XSS attacks via inline script injection  
**Effort:** High

#### Current Implementation (VULNERABLE)

```typescript
// src/server/config/security.ts#L14-20
const scriptSrc = [
  "'self'",
  "'unsafe-inline'", // ⚠️ CRITICAL: Allows XSS attacks
  !isProduction ? "'unsafe-eval'" : '',
  'https://cdn.jsdelivr.net'
]
  .filter(Boolean)
  .join(' ');
```

#### Task 1.1: Create Nonce Generation Utility

Create `src/server/lib/csp-nonce.ts`:

```typescript
import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure nonce for CSP
 * Must be called once per request and passed to both CSP header and inline scripts
 */
export function generateCspNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Type-safe nonce storage for request context
 */
export interface CspNonceContext {
  cspNonce: string;
}
```

#### Task 1.2: Create CSP Middleware Plugin

Create `src/server/middleware/csp.middleware.ts`:

```typescript
import { Elysia } from 'elysia';
import { generateCspNonce } from '../lib/csp-nonce';
import { env } from '@/lib/env';

const isProduction = env.NODE_ENV === 'production';

export const cspMiddleware = new Elysia({ name: 'csp' }).derive(({ set }) => {
  const nonce = generateCspNonce();

  // Build CSP directives with nonce instead of unsafe-inline
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net${!isProduction ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", // Styles can keep unsafe-inline (lower risk)
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests'
  ].join('; ');

  set.headers['Content-Security-Policy'] = directives;

  return { cspNonce: nonce };
});
```

#### Task 1.3: Update Next.js Configuration for Nonce

Modify `next.config.ts` to support nonce in Script components:

```typescript
// next.config.ts - Add experimental feature
const nextConfig: NextConfig = {
  experimental: {
    // Enable nonce support for inline scripts
    strictNextHead: true
  }
  // ... existing config
};
```

#### Task 1.4: Create Nonce Provider for React Components

Create `src/components/providers/csp-nonce-provider.tsx`:

```typescript
'use client';

import { createContext, useContext, type ReactNode } from 'react';

const NonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider({
  nonce,
  children
}: {
  nonce: string;
  children: ReactNode;
}) {
  return (
    <NonceContext.Provider value={nonce}>
      {children}
    </NonceContext.Provider>
  );
}

export function useCspNonce(): string {
  const nonce = useContext(NonceContext);
  if (!nonce) {
    throw new Error('useCspNonce must be used within CspNonceProvider');
  }
  return nonce;
}
```

#### Task 1.5: Update Root Layout

Modify `src/app/layout.tsx` to pass nonce:

```typescript
import { headers } from 'next/headers';
import { CspNonceProvider } from '@/components/providers/csp-nonce-provider';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') ?? '';

  return (
    <html lang="en">
      <body>
        <CspNonceProvider nonce={nonce}>
          {children}
        </CspNonceProvider>
      </body>
    </html>
  );
}
```

#### Task 1.6: Remove `unsafe-inline` from Security Config

Update `src/server/config/security.ts`:

```typescript
// AFTER: Remove unsafe-inline, CSP is now handled by middleware
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  // CSP is now set dynamically by cspMiddleware with per-request nonce
};
```

#### Verification

```bash
# Test CSP headers
curl -I http://localhost:3000 | grep -i content-security-policy
# Should show: script-src 'self' 'nonce-xxxxx' https://cdn.jsdelivr.net

# Verify no unsafe-inline
curl -I http://localhost:3000 | grep unsafe-inline
# Should return empty (no matches)
```

---

### C-2: Remove Hardcoded Test Secrets from Source Code

**Location:** `tests/setup.ts`  
**Risk:** Weak secrets in production if test setup is accidentally included  
**Effort:** Low

#### Current Implementation (VULNERABLE)

```typescript
// tests/setup.ts#L24-28
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret';
process.env.AUTH_SECRET = 'test-auth-secret-for-testing';
```

#### Task 2.1: Create `.env.test` File

Create `.env.test` (add to `.gitignore`):

```bash
# .env.test - Test environment secrets
# DO NOT COMMIT - This file should be in .gitignore
JWT_SECRET=test-jwt-secret-minimum-32-characters-long
BETTER_AUTH_SECRET=test-better-auth-secret-minimum-32-chars
AUTH_SECRET=test-auth-secret-for-testing-min-32-chars
DATABASE_URL=postgres://test:test@localhost:5432/urlfy_test
REDIS_URL=redis://localhost:6379/1
```

#### Task 2.2: Update `tests/setup.ts`

```typescript
// tests/setup.ts - Load from .env.test instead of hardcoding
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(__dirname, '../.env.test') });

// Validate required test secrets are present
const requiredSecrets = [
  'JWT_SECRET',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET'
] as const;

for (const secret of requiredSecrets) {
  if (!process.env[secret] || process.env[secret]!.length < 32) {
    throw new Error(
      `Missing or invalid ${secret} in .env.test. ` +
        `Create .env.test with secrets at least 32 characters long.`
    );
  }
}

// ... rest of setup
```

#### Task 2.3: Add CI Guard Against Test Secrets in Production

Create `scripts/check-test-secrets.ts`:

```typescript
#!/usr/bin/env bun
/**
 * CI guard to ensure test secrets are not in production builds
 * Run in CI before deployment: bun run scripts/check-test-secrets.ts
 */

const KNOWN_TEST_SECRETS = [
  'test-secret-key-for-unit-tests',
  'test-better-auth-secret',
  'test-auth-secret-for-testing',
  'test-jwt-secret'
];

const secretsToCheck = [
  process.env.JWT_SECRET,
  process.env.BETTER_AUTH_SECRET,
  process.env.AUTH_SECRET
];

let hasTestSecrets = false;

for (const secret of secretsToCheck) {
  if (secret && KNOWN_TEST_SECRETS.some((test) => secret.includes(test))) {
    console.error('❌ CRITICAL: Test secret detected in environment!');
    console.error(
      '   This indicates .env.test may have leaked into production.'
    );
    hasTestSecrets = true;
  }
}

if (hasTestSecrets) {
  process.exit(1);
}

console.log('✅ No test secrets detected in environment');
process.exit(0);
```

#### Task 2.4: Update `.gitignore`

```gitignore
# Environment files
.env
.env.local
.env.production
.env.test
```

#### Task 2.5: Add npm Script and CI Step

Update `package.json`:

```json
{
  "scripts": {
    "check:secrets": "bun run scripts/check-test-secrets.ts",
    "prebuild": "bun run check:secrets"
  }
}
```

---

## Sprint 2: High Priority Issues (Week 1 - 3 days)

### H-1: Add Rate Limiting to Admin Endpoints

**Location:** `src/server/modules/users/users.controller.ts`  
**Risk:** Admin account enumeration and brute force attacks  
**Effort:** Medium

#### Current State

Admin endpoints in `users.controller.ts` lack rate limiting:

- `POST /api/users/:id/ban` - No rate limit
- `POST /api/users/:id/unban` - No rate limit
- `PATCH /api/users/:id/role` - No rate limit

#### Task 1: Add Rate Limiting to Admin User Management

Update `src/server/modules/users/users.controller.ts`:

```typescript
import { createRateLimitMiddleware } from '@/server/lib/rate-limit';

// Define admin rate limit: 30 requests per minute per token
const adminRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: ({ user }) => `admin:${user?.id ?? 'anonymous'}`,
  handler: ({ set }) => {
    set.status = 429;
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many admin requests. Please wait before trying again.'
      }
    };
  }
});

export const usersController = new Elysia({ prefix: '/users' })
  .use(requireAuth)
  .use(requireAdmin)
  .use(adminRateLimit); // Apply rate limiting to all admin endpoints
// ... routes
```

#### Task 2: Add Rate Limit Config to `src/server/config/rate-limits.ts`

```typescript
export const RATE_LIMITS = {
  // Existing limits
  LINK_CREATE_GUEST: { windowMs: 60 * 60 * 1000, max: 10 },
  LINK_CREATE_AUTH: { windowMs: 60 * 60 * 1000, max: 100 },

  // NEW: Admin limits
  ADMIN_GENERAL: { windowMs: 60 * 1000, max: 30 },
  ADMIN_USER_MANAGEMENT: { windowMs: 60 * 1000, max: 20 },
  ADMIN_LINK_BAN: { windowMs: 60 * 1000, max: 50 }
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;
```

---

### H-2: Cache Analytics Aggregations

**Location:** `src/server/modules/analytics/analytics.service.ts`  
**Risk:** Database overload from repeated dashboard queries  
**Effort:** Medium

#### Current State

Analytics queries hit PostgreSQL on every request with no caching.

#### Task 1: Add Cache Keys for Analytics

Update `src/server/lib/cache-keys.ts`:

```typescript
export const CACHE_KEYS = {
  // Existing keys
  LINK: (code: string) => `link:${code}`,
  LINK_404: (code: string) => `link:404:${code}`,

  // NEW: Analytics cache keys
  ANALYTICS_SUMMARY: (linkId: string, from: string, to: string) =>
    `analytics:summary:${linkId}:${from}:${to}`,
  ANALYTICS_TIMESERIES: (
    linkId: string,
    from: string,
    to: string,
    granularity: string
  ) => `analytics:timeseries:${linkId}:${from}:${to}:${granularity}`,
  ANALYTICS_BREAKDOWN: (
    linkId: string,
    type: string,
    from: string,
    to: string
  ) => `analytics:breakdown:${linkId}:${type}:${from}:${to}`
} as const;

export const CACHE_TTL = {
  LINK: 3600, // 1 hour
  LINK_404: 300, // 5 minutes
  ANALYTICS: 300, // 5 minutes for analytics
  ANALYTICS_SUMMARY: 300
} as const;
```

#### Task 2: Update `analytics.service.ts` with Caching

```typescript
import { getRedisClient } from '@/server/lib/redis';
import { CACHE_KEYS, CACHE_TTL } from '@/server/lib/cache-keys';

export const AnalyticsService = {
  async getSummary(
    linkId: string,
    from: Date,
    to: Date
  ): Promise<AnalyticsSummary> {
    const redis = getRedisClient();
    const cacheKey = CACHE_KEYS.ANALYTICS_SUMMARY(
      linkId,
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0]
    );

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as AnalyticsSummary;
    }

    // Query database
    const summary = await this.querySummaryFromDb(linkId, from, to);

    // Cache result
    await redis.setex(cacheKey, CACHE_TTL.ANALYTICS, JSON.stringify(summary));

    return summary;
  }

  // ... similar pattern for getTimeSeries, getBreakdown
};
```

#### Task 3: Add Cache Invalidation on New Events

Update `src/server/workers/analytics.worker.ts`:

```typescript
import { CACHE_KEYS } from '@/server/lib/cache-keys';

async function processClickEvent(event: ClickEvent): Promise<void> {
  // ... existing processing logic

  // Invalidate analytics cache for this link
  const redis = getRedisClient();
  const pattern = `analytics:*:${event.linkId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

### H-3: Standardize Error Handling Pattern

**Location:** Multiple controllers  
**Risk:** Inconsistent error responses, harder debugging  
**Effort:** Medium

#### Current State

4 different error handling patterns exist:

- Pattern A: Manual try/catch with inline error response
- Pattern B: `handleControllerError` helper
- Pattern C: Direct `handleLinkError` call
- Pattern D: Elysia's `status()` function

#### Task 1: Create Unified Error Handler

Create `src/server/lib/error-handler.ts`:

```typescript
import { type StatusMap } from 'elysia';

/**
 * Application error codes with their HTTP status mappings
 */
export const ErrorCode = {
  // 400 Bad Request
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_URL: 'INVALID_URL',

  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',

  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',

  // 404 Not Found
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 409 Conflict
  ALIAS_TAKEN: 'ALIAS_TAKEN',

  // 410 Gone
  LINK_EXPIRED: 'LINK_EXPIRED',
  LINK_DELETED: 'LINK_DELETED',

  // 429 Too Many Requests
  RATE_LIMITED: 'RATE_LIMITED',

  // 451 Unavailable For Legal Reasons
  LINK_BANNED: 'LINK_BANNED',

  // 500 Internal Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

const ERROR_STATUS_MAP: Record<ErrorCodeType, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_URL]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.PASSWORD_REQUIRED]: 401,
  [ErrorCode.INVALID_PASSWORD]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ADMIN_REQUIRED]: 403,
  [ErrorCode.LINK_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.ALIAS_TAKEN]: 409,
  [ErrorCode.LINK_EXPIRED]: 410,
  [ErrorCode.LINK_DELETED]: 410,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.LINK_BANNED]: 451,
  [ErrorCode.INTERNAL_ERROR]: 500
};

/**
 * Custom application error with code and message
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_STATUS_MAP[this.code];
  }

  toResponse() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Type-safe error thrower for use in controllers
 */
export function throwAppError(
  code: ErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new AppError(code, message, details);
}
```

#### Task 2: Create Elysia Error Plugin

Create `src/server/middleware/error.middleware.ts`:

```typescript
import { Elysia } from 'elysia';
import { AppError, ErrorCode } from '../lib/error-handler';

export const errorMiddleware = new Elysia({ name: 'error-handler' }).onError(
  ({ error, set }) => {
    // Handle AppError
    if (error instanceof AppError) {
      set.status = error.status;
      return error.toResponse();
    }

    // Handle Elysia validation errors
    if (error.name === 'ValidationError') {
      set.status = 400;
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.message
        }
      };
    }

    // Handle unknown errors
    console.error('Unhandled error:', error);
    set.status = 500;
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred'
      }
    };
  }
);
```

#### Task 3: Update Controllers to Use New Pattern

Example migration in `src/server/modules/links/links.controller.ts`:

```typescript
// BEFORE
try {
  const link = await LinkService.create(body, user.id);
  return { success: true, data: link };
} catch (error) {
  set.status = 400;
  return { success: false, error: { code: 'CREATE_FAILED' } };
}

// AFTER
import { AppError, ErrorCode, throwAppError } from '@/server/lib/error-handler';

// Service throws AppError
const link = await LinkService.create(body, user.id);
return { success: true, data: link };
// Error handling is automatic via errorMiddleware
```

Update service to throw `AppError`:

```typescript
// In links.service.ts
if (existingAlias) {
  throw new AppError(
    ErrorCode.ALIAS_TAKEN,
    `The alias "${customAlias}" is already taken`,
    { alias: customAlias }
  );
}
```

---

### H-4: Split Large Files (>500 lines)

**Locations:** 5 files identified  
**Effort:** Medium per file

#### H-4.1: Split `src/lib/api-client.ts` (1058 lines)

Create new structure:

```
src/lib/api/
├── client.ts           # Eden client initialization, handleEden helper
├── error.ts            # ApiClientError class, error handling utilities
├── types.ts            # Shared types (PaginatedResponse, etc.)
├── links.ts            # Links API methods
├── analytics.ts        # Analytics API methods
├── admin.ts            # Admin API methods
├── users.ts            # Users API methods
├── auth.ts             # Auth API methods
└── index.ts            # Re-exports for backward compatibility
```

**`src/lib/api/client.ts`:**

```typescript
import { treaty } from '@elysiajs/eden';
import type { Api } from '@/server';

// Eden client singleton
let _client: ReturnType<typeof treaty<Api>> | null = null;

export function getApiClient() {
  if (!_client) {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

    _client = treaty<Api>(baseUrl);
  }
  return _client;
}

export type ApiClient = ReturnType<typeof getApiClient>;
```

**`src/lib/api/links.ts`:**

```typescript
import { getApiClient } from './client';
import { handleEden } from './error';
import type { Link, CreateLinkInput, UpdateLinkInput } from '@/types/links';

export const linksApi = {
  create: async (input: CreateLinkInput): Promise<Link> => {
    const client = getApiClient();
    return handleEden(client.api.links.post(input));
  },

  get: async (id: string): Promise<Link> => {
    const client = getApiClient();
    return handleEden(client.api.links({ id }).get());
  }

  // ... other methods
};
```

**`src/lib/api/index.ts` (backward compatibility):**

```typescript
// Re-export for backward compatibility
export { getApiClient, type ApiClient } from './client';
export { ApiClientError, handleEden } from './error';
export { linksApi } from './links';
export { analyticsApi } from './analytics';
export { adminApi } from './admin';
export { usersApi } from './users';
export { authApi } from './auth';

// Aggregated API object for convenience
export const api = {
  links: linksApi,
  analytics: analyticsApi,
  admin: adminApi,
  users: usersApi,
  auth: authApi
} as const;
```

#### H-4.2: Split `src/server/modules/links/links.service.ts` (602 lines)

Create new structure:

```
src/server/modules/links/
├── links.service.ts           # Core CRUD (create, getById, update, list)
├── link-password.service.ts   # verifyPassword
├── link-lifecycle.service.ts  # delete, restore, duplicate, toggleActive
├── link-cache.service.ts      # Cache invalidation helpers
└── index.ts                   # Re-exports
```

#### H-4.3: Split `src/server/middleware/auth.middleware.ts` (517 lines)

Create new structure:

```
src/server/middleware/auth/
├── optional-auth.ts       # optionalAuth middleware
├── require-auth.ts        # requireAuth middleware
├── require-admin.ts       # requireAdmin middleware
├── require-2fa.ts         # require2FA middleware
├── api-key-auth.ts        # apiKeyAuth, requireApiKey middleware
├── test-helpers.ts        # getTestUserFromHeaders (dev only)
├── types.ts               # Shared types (AuthContext, etc.)
└── index.ts               # Re-exports
```

#### H-4.4: Split `src/server/services/redirect.service.ts` (507 lines)

Create new structure:

```
src/server/services/redirect/
├── redirect.service.ts       # Main resolve() method
├── redirect-validation.ts    # isExpired, isBanned, hasReachedMaxClicks
├── redirect-circuit.ts       # Circuit breaker configuration
└── index.ts                  # Re-exports
```

#### H-4.5: Split `src/server/lib/redis.ts` (422 lines)

Create new structure:

```
src/server/lib/redis/
├── redis.ts              # Real client (getRedisClient, health, close)
├── redis-mock.ts         # InMemoryRedis mock class
├── types.ts              # RedisClient type, RedisConfig
└── index.ts              # Re-exports with environment detection
```

---

### H-5: Add Dependency Vulnerability Scanning

**Effort:** Low

#### Task 1: Install Snyk or npm audit

```bash
bun add -d snyk
```

#### Task 2: Add Security Check Script

Update `package.json`:

```json
{
  "scripts": {
    "security:check": "snyk test --severity-threshold=high",
    "security:report": "bun run scripts/security-report.ts"
  }
}
```

#### Task 3: Add to CI Pipeline

Create `.github/workflows/security.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run security:check
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## Sprint 3: Medium Priority Refactoring (Week 2-3)

### M-1: Implement Dependency Injection for Database

**Effort:** High (affects many files)

#### Task 1: Create Database Plugin

Create `src/server/plugins/database.plugin.ts`:

```typescript
import { Elysia } from 'elysia';
import { db } from '@/db';
import type { DrizzleDatabase } from '@/db';

export const databasePlugin = new Elysia({ name: 'database' }).decorate(
  'db',
  db
);

// Type augmentation for Elysia context
declare module 'elysia' {
  interface ElysiaContext {
    db: DrizzleDatabase;
  }
}
```

#### Task 2: Update Services to Accept db Parameter

```typescript
// BEFORE
import { db } from '@/db';

export const LinkService = {
  async create(input: CreateLinkInput) {
    return db.insert(links).values(input);
  }
};

// AFTER
export const LinkService = {
  async create(db: DrizzleDatabase, input: CreateLinkInput) {
    return db.insert(links).values(input);
  }
};
```

#### Task 3: Update Controllers to Pass db

```typescript
export const linksController = new Elysia({ prefix: '/links' })
  .use(databasePlugin)
  .post('/', async ({ body, user, db }) => {
    const link = await LinkService.create(db, body, user!.id);
    return { success: true, data: link };
  });
```

---

### M-2: Unify Comment Language to English

**Effort:** Low (find and replace)

Use search and replace to find Portuguese comments:

```bash
# Find Portuguese comments
grep -rn "// " src/ | grep -E "(Verifica|Retorna|Cria|Atualiza|Remove|Lista|Busca)"
```

Convert to English:

```typescript
// BEFORE
// Verifica se o link existe
// Retorna erro se não encontrado

// AFTER
// Check if link exists
// Return error if not found
```

---

### M-3: Add Field Selection to Link List API

**Effort:** Medium

#### Task 1: Add `fields` Query Parameter

Update `src/server/modules/links/links.schema.ts`:

```typescript
export const ListLinksQuery = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  perPage: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  sort: t.Optional(t.String()),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  search: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal('all'),
      t.Literal('active'),
      t.Literal('inactive'),
      t.Literal('expired')
    ])
  ),
  // NEW: Field selection
  fields: t.Optional(
    t.String({
      description: 'Comma-separated list of fields to return',
      examples: ['id,shortCode,originalUrl', 'id,clicksCount']
    })
  )
});

export type ListLinksQueryType = Static<typeof ListLinksQuery>;
```

#### Task 2: Implement Field Filtering

```typescript
// In links.service.ts
const ALLOWED_FIELDS = [
  'id',
  'shortCode',
  'originalUrl',
  'clicksCount',
  'isActive',
  'createdAt',
  'expiresAt'
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

function filterFields<T extends Record<string, unknown>>(
  data: T,
  fields?: string
): Partial<T> {
  if (!fields) return data;

  const requestedFields = fields.split(',').map((f) => f.trim());
  const validFields = requestedFields.filter((f): f is AllowedField =>
    ALLOWED_FIELDS.includes(f as AllowedField)
  );

  return Object.fromEntries(
    validFields.map((field) => [field, data[field]])
  ) as Partial<T>;
}
```

---

### M-4 through M-12: Remaining Medium Priority Tasks

| Task | Description                          | Location                            | Action                                        |
| ---- | ------------------------------------ | ----------------------------------- | --------------------------------------------- |
| M-4  | Extract mock Redis                   | `src/server/lib/redis.ts`           | Move `InMemoryRedis` class to `redis-mock.ts` |
| M-5  | Create coding standards doc          | `docs/development/`                 | Document all patterns from analysis           |
| M-6  | Add barrel exports                   | `src/components/*/`                 | Create `index.ts` in each component folder    |
| M-7  | Simplify complex conditionals        | `rate-limit.ts`, `url-validator.ts` | Use early returns, guard clauses              |
| M-8  | Add query explain for slow queries   | Analytics service                   | Add `EXPLAIN ANALYZE` in dev mode             |
| M-9  | Add integration tests for edge cases | `tests/integration/`                | Cover cache stampede, circuit breaker         |
| M-10 | Centralize error messages            | `src/server/lib/`                   | Create `error-messages.constants.ts`          |
| M-11 | Remove console.log from tests        | `tests/`                            | Replace with structured test logger           |
| M-12 | Add API response compression         | Elysia config                       | Add `compression` plugin                      |

---

## Sprint 4: Low Priority Improvements (Backlog)

### L-1: Flatten Nested Controller Structure

**Current:**

```
src/server/modules/links/
├── controllers/
│   ├── protected.controller.ts
│   └── public.controller.ts
└── links.controller.ts  # Just re-exports
```

**Target:**

```
src/server/modules/links/
├── links.controller.ts       # Protected routes
├── links-public.controller.ts # Public routes
└── index.ts                   # Exports both
```

### L-2: Add README to Key Directories

Create READMEs for:

- `src/server/modules/README.md`
- `src/server/middleware/README.md`
- `src/db/schema/README.md`

Template:

```markdown
# [Directory Name]

## Purpose

[Brief description]

## Structure

[File listing with descriptions]

## Patterns Used

[Document patterns specific to this directory]

## Adding New Files

[Instructions for adding new modules]
```

### L-3: Extract Shared Validation Utilities

Consolidate validation logic from:

- `src/server/services/url-validator.ts`
- `src/server/lib/validation/`

Into unified:

```
src/server/lib/validation/
├── url.ts          # URL validation
├── slug.ts         # Slug/alias validation
├── password.ts     # Password strength validation
└── index.ts
```

### L-4: Implement Query Result Pagination Limits

Add max limits to prevent memory issues:

```typescript
export const PAGINATION_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_TOTAL_RESULTS: 10000 // Prevent scanning entire tables
} as const;
```

### L-5: Add Performance Monitoring Dashboard

Create SigNoz dashboard with:

- P50/P95/P99 latency charts
- Request rate per endpoint
- Cache hit ratio
- Database query duration
- Error rate by endpoint

---

## Implementation Checklist

### Sprint 1 (Critical)

- [ ] C-1.1: Create nonce generation utility
- [ ] C-1.2: Create CSP middleware plugin
- [ ] C-1.3: Update Next.js configuration
- [ ] C-1.4: Create nonce provider component
- [ ] C-1.5: Update root layout
- [ ] C-1.6: Remove unsafe-inline from config
- [ ] C-2.1: Create `.env.test` file
- [ ] C-2.2: Update `tests/setup.ts`
- [ ] C-2.3: Add CI guard script
- [ ] C-2.4: Update `.gitignore`
- [ ] C-2.5: Add npm script

### Sprint 2 (High)

- [ ] H-1: Add rate limiting to admin endpoints
- [ ] H-2: Cache analytics aggregations
- [ ] H-3: Standardize error handling
- [ ] H-4.1: Split api-client.ts
- [ ] H-4.2: Split links.service.ts
- [ ] H-4.3: Split auth.middleware.ts
- [ ] H-4.4: Split redirect.service.ts
- [ ] H-4.5: Split redis.ts
- [ ] H-5: Add vulnerability scanning

### Sprint 3 (Medium)

- [ ] M-1: Implement dependency injection
- [ ] M-2: Unify comments to English
- [ ] M-3: Add field selection to API
- [ ] M-4 through M-12: See table above

### Sprint 4 (Low)

- [ ] L-1: Flatten controller structure
- [ ] L-2: Add directory READMEs
- [ ] L-3: Extract validation utilities
- [ ] L-4: Add pagination limits
- [ ] L-5: Create SigNoz dashboard

---

## Best Practices Enforcement

### TypeScript Strict Mode

- Ensure `strict: true` in `tsconfig.json`
- No `any` types without explicit `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with justification
- Use `unknown` instead of `any` for external data

### Type Safety with TypeBox

```typescript
// ✅ CORRECT: Single source of truth
const Schema = t.Object({ name: t.String() });
type SchemaType = Static<typeof Schema>;

// ❌ WRONG: Duplicated types
interface Schema {
  name: string;
}
const schema = t.Object({ name: t.String() });
```

### Error Handling

```typescript
// ✅ CORRECT: Use AppError with codes
throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');

// ❌ WRONG: Generic Error
throw new Error('Link not found');
```

### Service Pattern

```typescript
// ✅ CORRECT: Static methods, no HTTP concerns
export const LinkService = {
  async create(db: DrizzleDatabase, input: CreateLinkInput): Promise<Link> {
    // Pure business logic
  }
};

// ❌ WRONG: HTTP concerns in service
export const LinkService = {
  async create(ctx: Context) {
    ctx.set.status = 201; // NO!
  }
};
```

### Cache Key Naming

```typescript
// ✅ CORRECT: Typed, centralized
CACHE_KEYS.LINK(code); // "link:abc123"
CACHE_KEYS.ANALYTICS_SUMMARY(id, from, to)
// ❌ WRONG: Inline strings
`link:${code}``analytics:${id}:summary`;
```

---

## Verification Commands

```bash
# Type checking
bun run type-check

# Linting
bun run lint

# Security scan
bun run security:check

# Run all tests
bun test

# Check for console.log in source
grep -rn "console.log" src/ --include="*.ts" | grep -v "// debug"

# Verify no unsafe-inline in CSP
curl -I http://localhost:3000 | grep -i "content-security-policy" | grep -v "unsafe-inline"

# Check file sizes
find src -name "*.ts" -exec wc -l {} + | sort -n | tail -20
```
