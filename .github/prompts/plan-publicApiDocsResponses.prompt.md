# Plan: Complete Public API Documentation with All Response Schemas

## Objective

Fix the incomplete API documentation at `http://localhost:3000/api/docs` by adding **comprehensive response schemas** (all success states AND all possible error states) to every public endpoint. The goal is to have a fully typed, self-documenting API that accurately represents all possible outcomes.

---

## Scope

**In Scope (Public API only):**

- `src/server/modules/public/v1-links.controller.ts` - Public API V1 Links
- `src/server/modules/api-keys/api-keys.controller.ts` - API Key Management
- `src/server/api/health.ts` - Health check endpoints (if public)

**Out of Scope:**

- Internal dashboard endpoints (`linksController`, `usersController`, `adminController`)
- Better-Auth endpoints (documented separately)

---

## Prerequisites

### 1. Understand Existing Infrastructure

The codebase already has a robust response schema system in `src/server/lib/response.schema.ts`:

```typescript
// Available error references (use t.Ref() for OpenAPI $ref):
t.Ref('response.error.400')  // VALIDATION_ERROR
t.Ref('response.error.401')  // UNAUTHORIZED
t.Ref('response.error.403')  // FORBIDDEN
t.Ref('response.error.404')  // NOT_FOUND / LINK_NOT_FOUND
t.Ref('response.error.409')  // CONFLICT / REQUEST_ALREADY_EXISTS
t.Ref('response.error.410')  // LINK_EXPIRED
t.Ref('response.error.421')  // REDIRECT_LOOP
t.Ref('response.error.422')  // URL_MALICIOUS / INVALID_URL
t.Ref('response.error.429')  // RATE_LIMITED
t.Ref('response.error.451')  // LINK_BANNED
t.Ref('response.error.500')  // INTERNAL_ERROR

// Success wrapper:
SuccessResponse(dataSchema, description?)
PaginatedResponse(dataSchema, description?)
```

### 2. Verify ResponseModels Plugin is Registered

Confirm that `ResponseModels` from `@/server/lib/response.schema` is used in:

- `src/server/api/index.ts` (main API) ✓
- `src/server/api/v1/index.ts` (public API V1) - **VERIFY**

---

## Implementation Tasks

### Task 1: Audit `v1-links.controller.ts` Endpoints

**File:** `src/server/modules/public/v1-links.controller.ts`

#### 1.1 Add Missing Imports

Ensure the following are imported at the top of the file:

```typescript
import {
  SuccessResponse,
  PaginatedResponse
} from '@/server/lib/response.schema';
import { t } from 'elysia';
```

#### 1.2 Endpoint: `POST /` and `POST /shorten` (Create Link)

**Current State:** Missing `response` property entirely.

**Required Response Schema:**

```typescript
{
  response: {
    201: SuccessResponse(
      t.Ref('links.response'),
      'Link created successfully'
    ),
    400: t.Ref('response.error.400'),   // Validation error (malformed body)
    401: t.Ref('response.error.401'),   // Invalid/expired API key
    403: t.Ref('response.error.403'),   // API key lacks required scope
    409: t.Ref('response.error.409'),   // Custom alias already exists
    422: t.Ref('response.error.422'),   // Invalid URL / blocked shortener / malicious URL
    429: t.Ref('response.error.429'),   // Rate limit exceeded
    500: t.Ref('response.error.500')    // Internal server error
  }
}
```

**Rationale for each error:**
| Code | Trigger Condition |
|------|-------------------|
| 400 | Body fails TypeBox validation (missing `url`, wrong types) |
| 401 | `x-api-key` header missing, malformed, or expired |
| 403 | API key does not have `links:write` scope |
| 409 | `customAlias` already taken by another link |
| 422 | URL validation fails: blocked domain, shortener loop, invalid protocol |
| 429 | Rate limit exceeded (sliding window per API key) |
| 500 | Database error, Redis unavailable, unexpected exception |

#### 1.3 Endpoint: `POST /bulk` (Bulk Create Links)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    201: SuccessResponse(
      t.Object({
        created: t.Number({ description: 'Number of links successfully created' }),
        failed: t.Number({ description: 'Number of links that failed to create' }),
        links: t.Array(t.Ref('links.response')),
        errors: t.Optional(t.Array(t.Object({
          index: t.Number(),
          url: t.String(),
          error: t.Object({
            code: t.String(),
            message: t.String()
          })
        })))
      }),
      'Bulk link creation result'
    ),
    400: t.Ref('response.error.400'),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    402: t.Object({
      success: t.Literal(false),
      error: t.Object({
        code: t.Literal('QUOTA_EXCEEDED'),
        message: t.String()
      })
    }, { description: 'User link quota exceeded' }),
    422: t.Ref('response.error.422'),
    429: t.Ref('response.error.429'),
    500: t.Ref('response.error.500')
  }
}
```

**Note:** If `402` is not in `CommonErrors`, add it to `src/server/lib/response.schema.ts`:

```typescript
// Add to CommonErrors object:
402: t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.Literal('QUOTA_EXCEEDED'),
    message: t.String({ default: 'Link quota exceeded for your plan' })
  })
}, { description: 'Payment Required / Quota Exceeded' })
```

#### 1.4 Endpoint: `GET /:code` (Get Link by Code)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Ref('links.response'),
      'Link details retrieved successfully'
    ),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    404: t.Ref('response.error.404'),   // Link not found
    410: t.Ref('response.error.410'),   // Link expired
    451: t.Ref('response.error.451'),   // Link banned
    500: t.Ref('response.error.500')
  }
}
```

#### 1.5 Endpoint: `GET /` (List Links)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    200: PaginatedResponse(
      t.Ref('links.response'),
      'Paginated list of user links'
    ),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    429: t.Ref('response.error.429'),
    500: t.Ref('response.error.500')
  }
}
```

#### 1.6 Endpoint: `PATCH /:id` (Update Link)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Ref('links.response'),
      'Link updated successfully'
    ),
    400: t.Ref('response.error.400'),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    404: t.Ref('response.error.404'),
    409: t.Ref('response.error.409'),   // New alias conflicts
    422: t.Ref('response.error.422'),
    500: t.Ref('response.error.500')
  }
}
```

#### 1.7 Endpoint: `DELETE /:id` (Delete Link)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Object({
        deleted: t.Literal(true),
        id: t.String({ format: 'uuid' })
      }),
      'Link deleted successfully (soft delete)'
    ),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    404: t.Ref('response.error.404'),
    500: t.Ref('response.error.500')
  }
}
```

#### 1.8 Endpoint: `GET /:code/stats` (Get Link Stats)

**Current State:** Missing `response` property.

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Ref('links.stats.response'),
      'Link statistics retrieved successfully'
    ),
    401: t.Ref('response.error.401'),
    403: t.Ref('response.error.403'),
    404: t.Ref('response.error.404'),
    500: t.Ref('response.error.500')
  }
}
```

---

### Task 2: Audit `api-keys.controller.ts` Endpoints

**File:** `src/server/modules/api-keys/api-keys.controller.ts`

#### 2.1 Add Missing Imports

```typescript
import { SuccessResponse } from '@/server/lib/response.schema';
```

#### 2.2 Create API Key Response Schema

Add to `src/server/modules/api-keys/api-keys.schema.ts`:

```typescript
export const ApiKeyResponse = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    name: t.String(),
    prefix: t.String({
      description: 'First 8 characters of the key for identification'
    }),
    scopes: t.Array(t.String()),
    createdAt: t.String({ format: 'date-time' }),
    lastUsedAt: t.Nullable(t.String({ format: 'date-time' })),
    expiresAt: t.Nullable(t.String({ format: 'date-time' }))
  },
  {
    description: 'API Key details (key value is only shown on creation)'
  }
);

export const ApiKeyCreateResponse = t.Object(
  {
    ...ApiKeyResponse.properties,
    key: t.String({
      description: 'Full API key (only shown once at creation time)'
    })
  },
  {
    description: 'Newly created API key with full key value'
  }
);
```

Register in `ApiKeysModel`:

```typescript
export const ApiKeysModel = new Elysia({ name: 'api-keys.model' }).model({
  'api-keys.response': ApiKeyResponse,
  'api-keys.create.response': ApiKeyCreateResponse
  // ... existing models
});
```

#### 2.3 Endpoint: `GET /` (List API Keys)

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Object({
        keys: t.Array(t.Ref('api-keys.response')),
        total: t.Number()
      }),
      'List of user API keys'
    ),
    401: t.Ref('response.error.401'),   // Session required
    500: t.Ref('response.error.500')
  }
}
```

#### 2.4 Endpoint: `GET /:id` (Get API Key)

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Ref('api-keys.response'),
      'API key details'
    ),
    401: t.Ref('response.error.401'),
    404: t.Object({
      success: t.Literal(false),
      error: t.Object({
        code: t.Literal('KEY_NOT_FOUND'),
        message: t.String()
      })
    }, { description: 'API key not found' }),
    500: t.Ref('response.error.500')
  }
}
```

#### 2.5 Endpoint: `POST /` (Create API Key)

**Required Response Schema:**

```typescript
{
  response: {
    201: SuccessResponse(
      t.Ref('api-keys.create.response'),
      'API key created successfully. Save the key value as it will not be shown again.'
    ),
    400: t.Ref('response.error.400'),
    401: t.Ref('response.error.401'),
    500: t.Ref('response.error.500')
  }
}
```

#### 2.6 Endpoint: `PATCH /:id` (Update API Key)

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Ref('api-keys.response'),
      'API key updated successfully'
    ),
    400: t.Ref('response.error.400'),
    401: t.Ref('response.error.401'),
    404: t.Object({
      success: t.Literal(false),
      error: t.Object({
        code: t.Literal('KEY_NOT_FOUND'),
        message: t.String()
      })
    }),
    500: t.Ref('response.error.500')
  }
}
```

#### 2.7 Endpoint: `DELETE /:id` (Revoke API Key)

**Required Response Schema:**

```typescript
{
  response: {
    200: SuccessResponse(
      t.Object({
        revoked: t.Literal(true),
        id: t.String({ format: 'uuid' })
      }),
      'API key revoked successfully'
    ),
    401: t.Ref('response.error.401'),
    404: t.Object({
      success: t.Literal(false),
      error: t.Object({
        code: t.Literal('KEY_NOT_FOUND'),
        message: t.String()
      })
    }),
    500: t.Ref('response.error.500')
  }
}
```

---

### Task 3: Audit Health Endpoints

**File:** `src/server/api/health.ts`

#### 3.1 Endpoint: `GET /health`

**Required Response Schema:**

```typescript
{
  response: {
    200: t.Object({
      status: t.Literal('ok'),
      timestamp: t.String({ format: 'date-time' })
    }, { description: 'Service is healthy' }),
    503: t.Object({
      status: t.Literal('degraded'),
      timestamp: t.String({ format: 'date-time' }),
      issues: t.Optional(t.Array(t.String()))
    }, { description: 'Service is degraded' })
  }
}
```

#### 3.2 Endpoint: `GET /health/ready`

**Required Response Schema:**

```typescript
{
  response: {
    200: t.Object({
      status: t.Literal('ready'),
      services: t.Object({
        database: t.Union([t.Literal('ok'), t.Literal('error')]),
        redis: t.Union([t.Literal('ok'), t.Literal('error')])
      })
    }, { description: 'Service is ready to accept traffic' }),
    503: t.Object({
      status: t.Literal('not_ready'),
      services: t.Object({
        database: t.Union([t.Literal('ok'), t.Literal('error')]),
        redis: t.Union([t.Literal('ok'), t.Literal('error')])
      })
    }, { description: 'Service is not ready' })
  }
}
```

---

### Task 4: Add Missing Error Code to ResponseModels (Optional)

**File:** `src/server/lib/response.schema.ts`

If `402 QUOTA_EXCEEDED` is not already defined, add it:

```typescript
// In CommonErrors object:
402: t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.Literal('QUOTA_EXCEEDED'),
    message: t.String({ default: 'You have reached your link quota. Upgrade your plan to create more links.' })
  })
}, { description: 'Payment Required - Quota Exceeded' }),
```

And register in `ResponseModels`:

```typescript
.model('response.error.402', CommonErrors[402])
```

---

## Validation Checklist

After implementation, verify:

- [ ] Visit `http://localhost:3000/api/docs` and expand each endpoint
- [ ] Confirm all endpoints show complete response schemas
- [ ] Verify each error code displays with proper description
- [ ] Check that `$ref` references resolve correctly (e.g., `links.response`)
- [ ] Run `bun run build` to ensure no TypeScript errors
- [ ] Test one endpoint manually to confirm runtime behavior matches docs

---

## Best Practices Applied

1. **Single Source of Truth:** All response schemas use `t.Ref()` to reference centralized models
2. **Type Safety:** All schemas are TypeBox (`t.Object()`) ensuring runtime validation matches documentation
3. **Consistency:** Error responses follow the standard envelope `{ success: false, error: { code, message } }`
4. **Discoverability:** Each schema includes `description` for OpenAPI rendering
5. **Examples:** Success responses include `examples` arrays where applicable
6. **Separation of Concerns:** Model definitions in `.schema.ts`, usage in `.controller.ts`

---

## Files to Modify (Summary)

| File                                                 | Action                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/server/modules/public/v1-links.controller.ts`   | Add `response` property to all endpoints                |
| `src/server/modules/api-keys/api-keys.controller.ts` | Add `response` property to all endpoints                |
| `src/server/modules/api-keys/api-keys.schema.ts`     | Add `ApiKeyResponse` and `ApiKeyCreateResponse` schemas |
| `src/server/api/health.ts`                           | Add `response` property to health endpoints             |
| `src/server/lib/response.schema.ts`                  | Add `402` error if missing                              |

---

## Estimated Effort

| Task               | Effort       |
| ------------------ | ------------ |
| Task 1 (v1-links)  | ~45 min      |
| Task 2 (api-keys)  | ~30 min      |
| Task 3 (health)    | ~15 min      |
| Task 4 (402 error) | ~10 min      |
| Validation         | ~15 min      |
| **Total**          | **~2 hours** |
