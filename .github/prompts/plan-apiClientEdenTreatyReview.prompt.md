# API Client Eden Treaty Review & Type Safety Fix

## Executive Summary

The API client (`src/lib/api-client.ts`) was migrated to Elysia Eden Treaty but currently has:

- **10+ type suppressions** (`@ts-expect-error`, `as unknown as`, `biome-ignore noExplicitAny`)
- **Pagination meta inconsistencies** (`limit`/`totalPages` vs `perPage`/`lastPage`)
- **Duplicated type definitions** violating PRD's "Single Source of Truth" pattern
- **Backend-frontend type misalignments** requiring manual transformations

---

## Step 1: Standardize Pagination Meta in Backend

### Problem

Different controllers return different pagination meta structures:

**links.controller.ts (CORRECT):**

```typescript
meta: {
  total: number;
  page: number;
  perPage: number; // ✅ Correct
  lastPage: number; // ✅ Correct
  hasMore: boolean;
}
```

**audit.ts & analytics.controller.ts (INCORRECT):**

```typescript
meta: {
  total: number;
  page: number;
  limit: number; // ❌ Should be perPage
  totalPages: number; // ❌ Should be lastPage
  hasMore: boolean;
}
```

### Files to Modify

1. `src/server/api/admin/audit.ts`
   - Line ~85: Change `limit` to `perPage`
   - Line ~86: Change `totalPages` to `lastPage`

2. `src/server/modules/analytics/analytics.controller.ts`
   - All paginated endpoints must use `perPage`/`lastPage`
   - Check `getDailyStats`, `getBreakdown`, `getSummary` responses

### Expected Changes

```typescript
// BEFORE (audit.ts)
meta: {
  total: totalCount,
  page,
  limit,
  totalPages: Math.ceil(totalCount / limit),
  hasMore: page < Math.ceil(totalCount / limit)
}

// AFTER
meta: {
  total: totalCount,
  page,
  perPage: limit,
  lastPage: Math.ceil(totalCount / limit),
  hasMore: page < Math.ceil(totalCount / limit)
}
```

---

## Step 2: Create Shared Types Exported from Backend Schemas

### Problem

Types are duplicated between:

- `src/types/links.types.ts` (frontend interfaces)
- `src/server/modules/links/links.schema.ts` (TypeBox schemas)

The PRD mandates "Single Source of Truth" using TypeBox's `typeof schema.static`.

### Solution

Create barrel export that re-exports inferred types from backend schemas.

### Files to Create/Modify

1. **Create** `src/types/shared.ts` - Barrel export for shared types

```typescript
// src/types/shared.ts
/**
 * Shared types derived from backend schemas (Single Source of Truth)
 * Uses TypeBox's static type inference
 */

// Links
export type {
  LinkResponseType as LinkResponse,
  CreateLinkInputType as CreateLinkInput,
  UpdateLinkInputType as UpdateLinkInput,
  ListLinksQueryType as ListLinksQuery
} from '@/server/modules/links/links.schema';

// Analytics
export type {
  TimeSeriesType as TimeSeries,
  AnalyticsBreakdownType as AnalyticsBreakdown,
  AnalyticsSummaryType as AnalyticsSummary
} from '@/server/modules/analytics/analytics.schema';

// Pagination (create standard schema)
export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

2. **Modify** `src/types/links.types.ts`
   - Remove duplicated interfaces
   - Re-export from shared.ts
   - Keep any frontend-only extensions

3. **Modify** `src/types/analytics.types.ts`
   - Remove duplicated interfaces
   - Re-export from shared.ts

4. **Modify** `src/lib/api-client.ts`
   - Import from `@/types/shared` instead of local interfaces

### Backend Schema Export Requirements

Ensure these schemas export their static types:

```typescript
// src/server/modules/links/links.schema.ts
export const LinkResponse = t.Object({ ... });
export type LinkResponseType = typeof LinkResponse.static;

// src/server/modules/analytics/analytics.schema.ts
export const TimeSeries = t.Object({ ... });
export type TimeSeriesType = typeof TimeSeries.static;
```

---

## Step 3: Fix Analytics Type Mismatches

### Problem

Frontend `DailyStats` has fields that backend never returns:

```typescript
// Frontend expects (WRONG)
interface DailyStats {
  linkId: string; // ❌ Manually added in client
  date: string;
  clicks: number;
  uniqueVisitors: number;
  topCountry?: string; // ❌ Never returned
  topBrowser?: string; // ❌ Never returned
  topReferrer?: string; // ❌ Never returned
}

// Backend returns (CORRECT)
interface TimeSeries {
  date: string;
  clicks: number;
  uniqueVisitors: number;
}
```

### Files to Modify

1. `src/types/analytics.types.ts`
   - Remove `DailyStats` interface or align with `TimeSeries`
   - Remove phantom fields (`topCountry`, `topBrowser`, `topReferrer`)
   - If `linkId` is needed client-side, document it as client-added

2. `src/lib/api-client.ts` (getDailyStats function)
   - Return `TimeSeries[]` instead of `DailyStats[]`
   - OR: Keep transformation but document clearly

### Expected Changes

```typescript
// src/types/analytics.types.ts
// Option A: Use backend type directly
export type DailyStats = TimeSeries & {
  linkId: string; // Added client-side for context
};

// Option B: Remove DailyStats, use TimeSeries everywhere

// src/lib/api-client.ts
export async function getDailyStats(
  linkId: string,
  days = 30
): Promise<(TimeSeries & { linkId: string })[]> {
  // ... implementation with clear transformation
}
```

---

## Step 4: Align Analytics Query Parameters

### Problem

Frontend defines interface that backend doesn't accept:

```typescript
// Frontend (api-client.ts)
interface AnalyticsOptions {
  from?: string; // ❌ Not used by backend
  to?: string; // ❌ Not used by backend
  granularity?: 'hour' | 'day' | 'week'; // ❌ Not used by backend
}

// Backend (analytics.schema.ts)
AnalyticsDaysQuery = t.Object({
  days: t.Optional(t.String()) // ✅ Only accepts 'days'
});
```

### Solution Options

**Option A: Align frontend to backend** (Recommended)

```typescript
export interface AnalyticsOptions {
  days?: number; // Simplified to match backend
}
```

**Option B: Extend backend to support frontend**

```typescript
// Backend schema
AnalyticsQuerySchema = t.Object({
  days: t.Optional(t.String()),
  from: t.Optional(t.String({ format: 'date' })),
  to: t.Optional(t.String({ format: 'date' })),
  granularity: t.Optional(
    t.Union([t.Literal('hour'), t.Literal('day'), t.Literal('week')])
  )
});
```

### Files to Modify

1. `src/lib/api-client.ts`
   - Lines 312-340: Update `AnalyticsOptions` interface
   - Remove transformation logic that converts unsupported params

2. OR `src/server/modules/analytics/analytics.schema.ts`
   - Add support for `from`/`to`/`granularity` if needed

---

## Step 5: Eliminate Type Suppressions

### Current Suppressions in api-client.ts

| Line | Suppression        | Root Cause                                          |
| ---- | ------------------ | --------------------------------------------------- |
| 221  | `@ts-expect-error` | `validateUrl` response structure varies             |
| 323  | `@ts-expect-error` | Analytics returns `TimeSeries[]` not `DailyStats[]` |
| 337  | `biome-ignore`     | Query params type mismatch                          |
| 348  | `biome-ignore`     | Query params type mismatch                          |
| 360  | `biome-ignore`     | Query params type mismatch                          |
| 207  | `as unknown as`    | Paginated response type mismatch                    |
| 400  | `@ts-expect-error` | Audit logs pagination meta mismatch                 |
| 406  | `biome-ignore`     | Runtime meta normalization                          |

### Elimination Strategy

After completing Steps 1-4:

1. **Remove `as unknown as` casts**
   - Types should now align; Eden Treaty inference should work

2. **Remove `@ts-expect-error` comments**
   - Backend responses now match frontend expectations

3. **Remove `biome-ignore noExplicitAny`**
   - Query params should use proper types

4. **Simplify `handleEden` function**
   - Remove special cases for meta normalization
   - Trust Eden Treaty's type inference

### Expected Final handleEden

```typescript
function handleEden<T>(response: {
  data: ApiResponse<T> | null;
  error: { status: number; value: unknown } | null;
  response: Response;
  status: number;
}): T {
  if (response.error) {
    const errorValue = response.error.value as ApiErrorResponse;
    throw new ApiClientError(
      errorValue?.error?.code ?? 'UNKNOWN_ERROR',
      errorValue?.error?.message ?? 'Request failed',
      errorValue?.error?.details,
      errorValue?.requestId
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.data?.success) {
    throw new ApiClientError(
      response.data?.error?.code ?? 'NO_DATA',
      response.data?.error?.message ?? 'No data received'
    );
  }

  // Clean return - no special cases needed
  if (response.data.meta) {
    return { data: response.data.data, meta: response.data.meta } as T;
  }

  return response.data.data as T;
}
```

---

## Step 6: Fix DataDeletion Response Mismatch

### Problem

```typescript
// Backend (me.ts ~line 140)
return {
  success: true,
  data: {
    requestId: request.requestId,
    requestedAt: request.requestedAt,
    deadlineAt: request.deadline, // ❌ "deadlineAt" as Date
    message: '...'
  }
};

// Frontend expects (api-client.ts)
interface DataDeletionRequest {
  requestId: string;
  deadline: string; // ❌ "deadline" as string
  message: string;
}
```

### Solution

**Option A: Fix backend to match frontend** (Recommended)

```typescript
// me.ts
return {
  success: true,
  data: {
    requestId: request.requestId,
    deadline: request.deadline.toISOString(), // Renamed + serialized
    message: '...'
  }
};
```

**Option B: Fix frontend to match backend**

```typescript
// api-client.ts
interface DataDeletionRequest {
  requestId: string;
  deadlineAt: string; // Match backend naming
  message: string;
}
```

### Files to Modify

1. `src/server/api/users/me.ts`
   - Line ~140: Rename `deadlineAt` to `deadline`
   - Ensure Date is serialized to ISO string

2. `src/lib/api-client.ts`
   - Remove transformation in `requestDataDeletion` function
   - Lines 393-401: Simplify to direct return

---

## Step 7: Query Parameter Type Handling

### Problem

Elysia treats query params as strings by default. Frontend types use numbers/booleans.

```typescript
// Frontend query type
interface ListLinksQuery {
  page?: number; // number
  perPage?: number; // number
  isActive?: boolean; // boolean
}

// Backend expects (via TypeBox)
query: t.Object({
  page: t.Optional(t.String()), // string
  perPage: t.Optional(t.String()), // string
  isActive: t.Optional(t.String()) // string
});
```

### Solution Options

**Option A: Use `t.Numeric()` in backend** (Best DX)

```typescript
// Backend schema
query: t.Object({
  page: t.Optional(t.Numeric()),
  perPage: t.Optional(t.Numeric()),
  isActive: t.Optional(t.BooleanString())
});
```

**Option B: Create client-side helper** (Current approach, cleaner)

```typescript
// src/lib/api-client.ts
function toQueryParams(query: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.join(',');
      } else {
        result[key] = String(value);
      }
    }
  }
  return result;
}
```

### Files to Modify

1. `src/server/modules/links/links.schema.ts`
   - Use `t.Numeric()` for page/perPage
   - Use `t.BooleanString()` or custom transform for boolean

2. OR `src/lib/api-client.ts`
   - Create reusable `toQueryParams` helper
   - Apply to all query-accepting functions

---

## Step 8: Add Compile-Time Type Tests

### Purpose

Prevent future type drift between client and server by adding compile-time assertions.

### File to Create

`tests/types/api-client.types.test.ts`

```typescript
/**
 * Compile-time type tests for API client
 * These tests verify that Eden Treaty types match expected interfaces
 * If compilation fails, there's a type mismatch to fix
 */

import type { App } from '@/server/api';
import type { treaty } from '@elysiajs/eden';
import type { LinkResponse, PaginatedResponse } from '@/types/shared';

type Client = ReturnType<typeof treaty<App>>;

// Test: Links list returns paginated response
type LinksListResponse = Awaited<
  ReturnType<Client['api']['v1']['links']['get']>
>;
type _AssertLinksData = LinksListResponse['data'] extends {
  success: boolean;
  data: LinkResponse[];
  meta: { total: number; page: number; perPage: number };
} | null
  ? true
  : never;

// Test: Single link returns LinkResponse
type LinkGetResponse = Awaited<
  ReturnType<Client['api']['v1']['links'][':id']['get']>
>;
type _AssertLinkData = LinkGetResponse['data'] extends {
  success: boolean;
  data: LinkResponse;
} | null
  ? true
  : never;

// Test: Create link accepts correct input
type CreateLinkFn = Client['api']['v1']['links']['post'];
type _AssertCreateInput = Parameters<CreateLinkFn>[0] extends {
  url: string;
  customAlias?: string;
}
  ? true
  : never;

// Test: Delete returns void/204
type DeleteResponse = Awaited<
  ReturnType<Client['api']['v1']['links'][':id']['delete']>
>;
type _AssertDeleteVoid = DeleteResponse['status'] extends 204 | 200
  ? true
  : never;

// Ensure file is treated as module
export {};
```

---

## Implementation Order

1. **Step 1** - Pagination meta standardization (backend changes)
2. **Step 6** - DataDeletion response fix (backend change)
3. **Step 3** - Analytics types alignment (frontend types)
4. **Step 2** - Shared types barrel export (new file + refactor)
5. **Step 4** - Analytics query params (decision + implementation)
6. **Step 7** - Query parameter handling (backend or frontend)
7. **Step 5** - Eliminate suppressions (cleanup)
8. **Step 8** - Add type tests (safety net)

---

## Validation Checklist

After implementation, verify:

- [ ] `bun run typecheck` passes with no errors
- [ ] `bun run lint` passes with no biome-ignore directives in api-client.ts
- [ ] `bun test tests/integration/` passes
- [ ] No `@ts-expect-error` comments in api-client.ts
- [ ] No `as unknown as` casts in api-client.ts
- [ ] All pagination responses use `perPage`/`lastPage`
- [ ] Eden Treaty correctly infers all endpoint types
- [ ] Type tests in `tests/types/` compile successfully

---

## Files Summary

### To Modify

| File                                                   | Changes                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `src/server/api/admin/audit.ts`                        | Pagination meta: limit→perPage, totalPages→lastPage |
| `src/server/api/users/me.ts`                           | DataDeletion: deadlineAt→deadline, serialize Date   |
| `src/server/modules/analytics/analytics.controller.ts` | Verify pagination meta consistency                  |
| `src/server/modules/analytics/analytics.schema.ts`     | Export static types                                 |
| `src/server/modules/links/links.schema.ts`             | Export static types, optional: use t.Numeric()      |
| `src/types/links.types.ts`                             | Re-export from shared, remove duplicates            |
| `src/types/analytics.types.ts`                         | Fix DailyStats, re-export from shared               |
| `src/lib/api-client.ts`                                | Remove suppressions, simplify handleEden            |

### To Create

| File                                   | Purpose                        |
| -------------------------------------- | ------------------------------ |
| `src/types/shared.ts`                  | Barrel export for shared types |
| `tests/types/api-client.types.test.ts` | Compile-time type assertions   |
