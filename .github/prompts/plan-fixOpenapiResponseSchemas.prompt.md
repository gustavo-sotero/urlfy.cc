# Plan: Fix Empty OpenAPI Response Schemas & Migrate from Deprecated Swagger

## Problem Statement

The API documentation at `http://localhost:3000/api/docs` shows **empty 200 responses** for all endpoints because:

1. **Most endpoints lack `response` property** — Only ~11 out of 60+ endpoints define response schemas
2. **Inconsistent model registration** — Some modules use plain objects, others use Elysia plugins with `.model()`
3. **Deprecated package** — `@elysiajs/swagger` is deprecated; must migrate to `@elysiajs/openapi`

---

## Phase 1: Migrate from `@elysiajs/swagger` to `@elysiajs/openapi`

### Step 1.1: Update Dependencies

**File:** `package.json`

```bash
bun remove @elysiajs/swagger
bun add @elysiajs/openapi
```

### Step 1.2: Update API Entry Point

**File:** `src/server/api/index.ts`

Replace the deprecated swagger import and configuration:

```typescript
// BEFORE
import { swagger } from '@elysiajs/swagger';

// AFTER
import { openapi } from '@elysiajs/openapi';
```

Update plugin usage:

```typescript
// BEFORE
.use(
  swagger({
    documentation: { ... },
    path: '/docs',
    exclude: ['/auth/*', '/docs', '/docs/json']
  })
)

// AFTER
.use(
  openapi({
    documentation: { ... },
    path: '/docs',           // Keep /docs for backwards compatibility (default is /openapi)
    specPath: '/docs/json',  // OpenAPI spec endpoint
    exclude: {
      paths: ['/auth/*']
    }
  })
)
```

### Step 1.3: Verify Migration

- Access `http://localhost:3000/api/docs` — Should show Scalar UI (new default provider)
- Access `http://localhost:3000/api/docs/json` — Should return OpenAPI JSON spec

---

## Phase 2: Create Standardized Response Schema Library

### Step 2.1: Create Response Schema Utilities

**File:** `src/server/lib/response.schema.ts` (NEW)

```typescript
import { Elysia, t, type TSchema } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// RESPONSE WRAPPER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a success response schema wrapper
 * @param dataSchema - The schema for the `data` field
 * @param description - Optional description for OpenAPI docs
 */
export const SuccessResponse = <T extends TSchema>(
  dataSchema: T,
  description?: string
) =>
  t.Object(
    {
      success: t.Literal(true),
      data: dataSchema
    },
    { description: description ?? 'Successful response' }
  );

/**
 * Creates a paginated success response schema wrapper
 * @param itemSchema - The schema for each item in the `data` array
 */
export const PaginatedResponse = <T extends TSchema>(itemSchema: T) =>
  t.Object({
    success: t.Literal(true),
    data: t.Array(itemSchema),
    meta: t.Object({
      total: t.Number({ description: 'Total number of items' }),
      page: t.Number({ description: 'Current page number' }),
      perPage: t.Number({ description: 'Items per page' }),
      lastPage: t.Number({ description: 'Last page number' }),
      hasMore: t.Boolean({ description: 'Whether there are more pages' })
    })
  });

/**
 * Standard error response schema
 */
export const ErrorResponse = t.Object(
  {
    success: t.Literal(false),
    error: t.Object({
      code: t.String({ description: 'Error code (e.g., VALIDATION_ERROR)' }),
      message: t.String({ description: 'Human-readable error message' }),
      details: t.Optional(
        t.Unknown({ description: 'Additional error details' })
      )
    }),
    requestId: t.Optional(t.String({ description: 'Request correlation ID' }))
  },
  { description: 'Error response' }
);

// ═══════════════════════════════════════════════════════════════════
// COMMON ERROR RESPONSES BY STATUS CODE
// ═══════════════════════════════════════════════════════════════════

export const CommonErrors = {
  400: ErrorResponse,
  401: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('UNAUTHORIZED'),
      message: t.String()
    })
  }),
  403: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('FORBIDDEN'),
      message: t.String()
    })
  }),
  404: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('NOT_FOUND'),
      message: t.String()
    })
  }),
  429: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('RATE_LIMITED'),
      message: t.String(),
      retryAfter: t.Optional(
        t.Number({ description: 'Seconds until retry allowed' })
      )
    })
  }),
  500: t.Object({
    success: t.Literal(false),
    error: t.Object({
      code: t.Literal('INTERNAL_ERROR'),
      message: t.String()
    })
  })
} as const;

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for t.Ref usage)
// ═══════════════════════════════════════════════════════════════════

export const ResponseModels = new Elysia({ name: 'response.models' }).model({
  'response.error': ErrorResponse,
  'response.error.400': CommonErrors[400],
  'response.error.401': CommonErrors[401],
  'response.error.403': CommonErrors[403],
  'response.error.404': CommonErrors[404],
  'response.error.429': CommonErrors[429],
  'response.error.500': CommonErrors[500]
});
```

### Step 2.2: Export from Library Index

**File:** `src/server/lib/index.ts` (UPDATE or CREATE)

```typescript
export * from './response.schema';
```

---

## Phase 3: Standardize Model Registration Pattern

All modules should use the **Elysia plugin pattern** with `.model()` for proper OpenAPI $ref generation.

### Step 3.1: Convert Links Module

**File:** `src/server/modules/links/links.schema.ts`

**BEFORE (Plain Object Export):**

```typescript
export const LinkModel = {
  LinkCreateBody,
  LinkUpdateBody,
  LinkResponse
  // ...
};
```

**AFTER (Elysia Plugin Pattern):**

```typescript
import { Elysia, t } from 'elysia';

// ... existing schema definitions ...

// Register models for OpenAPI $ref support
export const LinksModel = new Elysia({ name: 'links.model' }).model({
  'links.create': LinkCreateBody,
  'links.update': LinkUpdateBody,
  'links.response': LinkResponse,
  'links.list.query': LinkListQuery,
  'links.stats': LinkStatsResponse,
  'links.preview': LinkPreviewResponse,
  'links.qr.query': QRCodeQuery
});

// Keep type exports for TypeScript inference
export type LinkCreateBodyType = typeof LinkCreateBody.static;
export type LinkUpdateBodyType = typeof LinkUpdateBody.static;
export type LinkResponseType = typeof LinkResponse.static;
```

### Step 3.2: Convert Auth Module

**File:** `src/server/modules/auth/auth.schema.ts`

Apply same pattern:

```typescript
export const AuthModel = new Elysia({ name: 'auth.model' }).model({
  'auth.session': SessionResponse,
  'auth.sessions.list': SessionListResponse,
  'auth.apikey': ApiKeyResponse,
  'auth.apikey.create': CreateApiKeyBody,
  'auth.2fa.setup': TwoFactorSetupResponse,
  'auth.2fa.verify': TwoFactorVerifyBody
});
```

### Step 3.3: Convert Analytics Module

**File:** `src/server/modules/analytics/analytics.schema.ts`

```typescript
export const AnalyticsModel = new Elysia({ name: 'analytics.model' }).model({
  'analytics.summary': AnalyticsSummaryResponse,
  'analytics.timeseries': TimeSeriesResponse,
  'analytics.breakdown': BreakdownResponse,
  'analytics.query': AnalyticsQueryParams
});
```

### Step 3.4: Verify Existing Models

Modules already using correct pattern (verify they're properly registered):

- `src/server/modules/users/users.schema.ts` — `UsersModel`
- `src/server/modules/admin/admin.schema.ts` — `AdminModel`

---

## Phase 4: Add Response Schemas to Controllers

### Step 4.1: Links Controller

**File:** `src/server/modules/links/links.controller.ts`

For each endpoint, add the `response` property. Example transformation:

**BEFORE:**

```typescript
.post(
  '/validate',
  async ({ body }) => {
    const validation = await validateUrlAsync(body.url);
    return { success: true, data: { valid: true, warnings: [] } };
  },
  {
    body: ValidateUrlBody,
    detail: {
      tags: ['Links'],
      summary: 'Validate URL'
    }
    // ❌ NO response schema!
  }
)
```

**AFTER:**

```typescript
.post(
  '/validate',
  async ({ body }) => {
    const validation = await validateUrlAsync(body.url);
    return { success: true as const, data: { valid: true, warnings: [] } };
  },
  {
    body: ValidateUrlBody,
    detail: {
      tags: ['Links'],
      summary: 'Validate URL',
      description: 'Check if a URL is valid before creating a link'
    },
    response: {
      200: t.Object({
        success: t.Literal(true),
        data: t.Object({
          valid: t.Boolean({ description: 'Whether the URL is valid' }),
          warnings: t.Array(t.String(), { description: 'Validation warnings' })
        })
      }),
      400: t.Ref('response.error.400'),
      422: t.Object({
        success: t.Literal(false),
        error: t.Object({
          code: t.Literal('URL_MALICIOUS'),
          message: t.String()
        })
      })
    }
  }
)
```

**Key Endpoints to Update in Links Controller:**

| Endpoint               | Method | Priority | Notes                            |
| ---------------------- | ------ | -------- | -------------------------------- |
| `/links`               | POST   | HIGH     | Create link - core functionality |
| `/links`               | GET    | HIGH     | List links - paginated response  |
| `/links/:id`           | GET    | HIGH     | Get single link                  |
| `/links/:id`           | PATCH  | HIGH     | Update link                      |
| `/links/:id`           | DELETE | MEDIUM   | Soft delete                      |
| `/links/:id/stats`     | GET    | MEDIUM   | Quick stats                      |
| `/links/:code/preview` | GET    | LOW      | Public preview                   |
| `/links/:code/qr`      | GET    | LOW      | QR code generation               |
| `/links/validate`      | POST   | LOW      | URL validation                   |
| `/links/bulk`          | POST   | LOW      | Bulk creation                    |

### Step 4.2: Auth Controller

**File:** `src/server/modules/auth/auth.controller.ts`

**Key Endpoints to Update:**

| Endpoint             | Method | Priority | Notes                |
| -------------------- | ------ | -------- | -------------------- |
| `/auth/session`      | GET    | HIGH     | Current session info |
| `/auth/sessions`     | GET    | HIGH     | List all sessions    |
| `/auth/sessions/:id` | DELETE | MEDIUM   | Revoke session       |
| `/auth/api-keys`     | GET    | HIGH     | List API keys        |
| `/auth/api-keys`     | POST   | HIGH     | Create API key       |
| `/auth/api-keys/:id` | DELETE | MEDIUM   | Revoke API key       |
| `/auth/2fa/setup`    | POST   | MEDIUM   | Setup 2FA            |
| `/auth/2fa/verify`   | POST   | MEDIUM   | Verify 2FA code      |
| `/auth/2fa/disable`  | POST   | LOW      | Disable 2FA          |

### Step 4.3: Users Controller

**File:** `src/server/modules/users/users.controller.ts`

**Key Endpoints to Update:**

| Endpoint          | Method | Priority | Notes                    |
| ----------------- | ------ | -------- | ------------------------ |
| `/users/profile`  | GET    | HIGH     | Get current user profile |
| `/users/profile`  | PATCH  | HIGH     | Update profile           |
| `/users/quota`    | GET    | MEDIUM   | Get links quota          |
| `/users/settings` | GET    | MEDIUM   | Get user settings        |
| `/users/settings` | PATCH  | MEDIUM   | Update settings          |

### Step 4.4: Analytics Controller

**File:** `src/server/modules/analytics/analytics.controller.ts`

**Key Endpoints to Update:**

| Endpoint                        | Method | Priority | Notes                       |
| ------------------------------- | ------ | -------- | --------------------------- |
| `/analytics/:linkId`            | GET    | HIGH     | Get detailed analytics      |
| `/analytics/:linkId/summary`    | GET    | MEDIUM   | Quick summary               |
| `/analytics/:linkId/timeseries` | GET    | MEDIUM   | Time-based data             |
| `/analytics/:linkId/breakdown`  | GET    | MEDIUM   | Geographic/device breakdown |

### Step 4.5: Admin Controller

**File:** `src/server/modules/admin/admin.controller.ts`

This controller already has some response schemas. Verify completeness and add missing ones.

**Key Endpoints to Update:**

| Endpoint            | Method | Priority | Notes                   |
| ------------------- | ------ | -------- | ----------------------- |
| `/admin/stats`      | GET    | HIGH     | Global KPIs             |
| `/admin/users`      | GET    | HIGH     | List users (paginated)  |
| `/admin/users/:id`  | PATCH  | MEDIUM   | Update user (ban, role) |
| `/admin/links`      | GET    | HIGH     | Search links            |
| `/admin/links/:id`  | PATCH  | MEDIUM   | Ban/unban link          |
| `/admin/audit-logs` | GET    | MEDIUM   | Audit trail             |

### Step 4.6: User Data Routes (me.ts)

**File:** `src/server/api/users/me.ts`

**Key Endpoints to Update:**

| Endpoint     | Method | Priority | Notes                 |
| ------------ | ------ | -------- | --------------------- |
| `/me/export` | GET    | MEDIUM   | LGPD data export      |
| `/me/data`   | DELETE | MEDIUM   | LGPD deletion request |
| `/consent`   | POST   | LOW      | Cookie consent        |

---

## Phase 5: Register Models in API Entry Point

**File:** `src/server/api/index.ts`

Import and register all model plugins:

```typescript
import { ResponseModels } from '@/server/lib/response.schema';
import { LinksModel } from '@/server/modules/links/links.schema';
import { AuthModel } from '@/server/modules/auth/auth.schema';
import { UsersModel } from '@/server/modules/users/users.schema';
import { AnalyticsModel } from '@/server/modules/analytics/analytics.schema';
import { AdminModel } from '@/server/modules/admin/admin.schema';

export const api = new Elysia({ prefix: '/api' })
  // Register all models FIRST for $ref to work
  .use(ResponseModels)
  .use(LinksModel)
  .use(AuthModel)
  .use(UsersModel)
  .use(AnalyticsModel)
  .use(AdminModel)
  // Then OpenAPI plugin
  .use(openapi({ ... }))
  // Then routes
  .use(linksController)
  // ...
```

---

## Phase 6: Type Safety Improvements

### Step 6.1: Use `as const` for Literal Types

Ensure all handlers return `success: true as const` or `success: false as const` for proper literal type inference:

```typescript
// ❌ BEFORE - TypeScript infers `boolean`
return { success: true, data: result };

// ✅ AFTER - TypeScript infers `true` literal
return { success: true as const, data: result };
```

### Step 6.2: Type-Check Response Against Schema

Create a utility type to validate handler return types:

```typescript
// src/server/lib/response.types.ts
import type { Static } from 'elysia';

export type InferResponse<T> = T extends { static: infer S } ? S : never;

// Usage in handler:
const handler = async (): Promise<InferResponse<typeof LinkResponse>> => {
  return { success: true as const, data: { ... } };
};
```

### Step 6.3: Extract Response Types for Reuse

```typescript
// In schema file
export const LinkResponse = t.Object({ ... });
export type LinkResponseType = typeof LinkResponse.static;

// In controller - type the handler
.get('/links/:id', async ({ params }): Promise<LinkResponseType> => {
  // ...
})
```

---

## Phase 7: Validation & Testing

### Step 7.1: Visual Verification

1. Start dev server: `bun dev`
2. Access `http://localhost:3000/api/docs`
3. For each endpoint, verify:
   - Response schema is displayed (not empty)
   - Schema matches actual response structure
   - Error responses are documented

### Step 7.2: OpenAPI Spec Validation

```bash
# Download spec
curl http://localhost:3000/api/docs/json > openapi.json

# Validate with spectral or similar tool
npx @stoplight/spectral-cli lint openapi.json
```

### Step 7.3: Type Safety Verification

```bash
bun type-check
```

Ensure no type errors related to response mismatches.

---

## Implementation Order (Suggested)

1. **Phase 1** — Migrate to `@elysiajs/openapi` (30 min)
2. **Phase 2** — Create response schema library (45 min)
3. **Phase 3** — Convert Links & Auth models (1 hour)
4. **Phase 4.1-4.2** — Update Links & Auth controllers (2 hours)
5. **Phase 5** — Register models in API entry (15 min)
6. **Phase 7.1** — Visual verification (30 min)
7. **Phase 4.3-4.6** — Update remaining controllers (2 hours)
8. **Phase 6** — Type safety improvements (1 hour)
9. **Phase 7.2-7.3** — Final validation (30 min)

**Total Estimated Time:** ~8 hours

---

## Files to Modify Summary

| File                                                   | Action                           | Phase |
| ------------------------------------------------------ | -------------------------------- | ----- |
| `package.json`                                         | Update deps                      | 1     |
| `src/server/api/index.ts`                              | Migrate plugin, register models  | 1, 5  |
| `src/server/lib/response.schema.ts`                    | CREATE                           | 2     |
| `src/server/modules/links/links.schema.ts`             | Convert to Elysia plugin         | 3     |
| `src/server/modules/auth/auth.schema.ts`               | Convert to Elysia plugin         | 3     |
| `src/server/modules/analytics/analytics.schema.ts`     | Convert to Elysia plugin         | 3     |
| `src/server/modules/links/links.controller.ts`         | Add response schemas             | 4     |
| `src/server/modules/auth/auth.controller.ts`           | Add response schemas             | 4     |
| `src/server/modules/users/users.controller.ts`         | Add response schemas             | 4     |
| `src/server/modules/analytics/analytics.controller.ts` | Add response schemas             | 4     |
| `src/server/modules/admin/admin.controller.ts`         | Verify/complete response schemas | 4     |
| `src/server/api/users/me.ts`                           | Add response schemas             | 4     |

---

## Success Criteria

- [ ] `@elysiajs/swagger` removed from dependencies
- [ ] `@elysiajs/openapi` installed and configured
- [ ] All endpoints show response schemas in `/api/docs`
- [ ] Response schemas include 200, 4xx, 5xx where applicable
- [ ] All models registered via Elysia `.model()` pattern
- [ ] `t.Ref()` works correctly for shared schemas
- [ ] `bun type-check` passes with no errors
- [ ] OpenAPI spec validates without errors
