# Plan: Fix API Client Response Handling for Pagination and Metadata

## Problem Analysis

The `urlfy.cc` frontend is experiencing empty states on the Dashboard, Links, and Analytics pages despite the backend returning valid data.

**Root Cause:**

1. **Backend Response Structure:** Paginated endpoints return a JSON object wrapping the data and metadata:
   ```json
   {
       "success": true,
       "data": [ ... ],
       "meta": { "total": 100, ... }
   }
   ```
2. **Current Fetcher Logic:** The `fetcher` function in `src/lib/api-client.ts` strictly returns `data.data` (the array), discarding siblings like `meta`.
   ```typescript
   // Current implementation
   return data.data as T;
   ```
3. **Type Mismatch:** The `getLinks` function expects a return type of `PaginatedResponse<LinkResponse>`, which is defined as:
   ```typescript
   export interface PaginatedResponse<T> {
     data: T[];
     meta: { ... };
   }
   ```
4. **Runtime Failure:** The component receives just the array `[...]` (casted improperly to `PaginatedResponse`), but tries to access properties like `response.data` or `response.meta`. Since `response` is an array, `response.data` is undefined, causing the UI to render empty states.

## implementation Steps

### 1. Update `ApiResponse` Interface

Modify `src/lib/api-client.ts` to include the optional `meta` property in the internal `ApiResponse` interface. This allows TypeScript to recognize the field during parsing.

```typescript
// src/lib/api-client.ts

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  // Add meta property to capture pagination metadata
  meta?: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
    hasMore: boolean;
  };
  error?: ApiError;
  requestId?: string;
}
```

### 2. Update `fetcher` Return Logic

Modify the `fetcher` function in `src/lib/api-client.ts` to conditionally return the full structure if `meta` is present.

**New Logic Flow:**

1. Check if the response was successful (`data.success`).
2. Check if `data.meta` exists (indicating a paginated or metadata-rich response).
3. **If `meta` exists**: Return an object containing both `data` and `meta`. This aligns with the `PaginatedResponse<T>` interface.
   ```typescript
   if (data.meta) {
     return {
       data: data.data,
       meta: data.meta
     } as unknown as T;
   }
   ```
4. **If `meta` does not exist**: Return `data.data` directly, maintaining backward compatibility for simple endpoints (like `getLink` or `createLink`) that return the resource directly.

### 3. Verification

Verify the fix against the failing pages:

1. **Links Page (`/dashboard/links`)**:
   - Component expects `data.data` (array of links) and `data.meta` (pagination stats).
   - With the fix, `useLinks` will return `{ data: [...], meta: {...} }`, resolving the `undefined` check.

2. **Dashboard Page (`/dashboard`)**:
   - Usage: `linksData?.meta?.total` and `linksData?.data`.
   - The fix ensures these properties are accessible on the returned object.

3. **Analytics Page**:
   - Analytics endpoints (e.g., `getDailyStats`) might also return metadata or specific structures. If they return `data` without `meta` wrapper in the API response, the default fallback works. _Note: Analytics types might need review if they rely on a different structure, but `getLinks` is the primary target._

## Code Changes

**File:** `src/lib/api-client.ts`

```typescript
// ... existing imports

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  // ADDED:
  meta?: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
    hasMore: boolean;
  };
  error?: ApiError;
  requestId?: string;
}

// ... inside fetcher<T> function ...

  // [Existing Error Handling]
  if (!data.success || !response.ok) {
    throw new ApiClientError(
      data.error?.code ?? 'UNKNOWN_ERROR',
      data.error?.message ?? 'Request failed',
      data.error?.details,
      data.requestId
    );
  }

  // MODIFIED RETURN LOGIC:

  // If the response contains metadata (pagination), return both data and meta.
  // This matches the PaginatedResponse<T> structure.
  if (data.meta) {
    return {
      data: data.data,
      meta: data.meta
    } as unknown as T;
  }

  // standard behavior for non-paginated responses
  return data.data as T;
}
```
