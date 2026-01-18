# Implementation Plan: Migrate to Elysia Eden Fetch

## Objective

Replace the current manual `fetch` implementation in `src/lib/api-client.ts` with `@elysiajs/eden`'s `edenFetch`.
**Goal:** Achieve end-to-end type safety between the Elysia backend and the Next.js frontend without breaking existing UI error handling.

## Scope

- **Target Files:**
  - `src/server/api/index.ts` (Backend entry)
  - `src/lib/api-client.ts` (Client wrapper)
  - `package.json`

## Detailed Implementation Steps

### 1. Backend Type Exposure

The Elysia instance type must be exported to allow inference on the client side.

- **File:** `src/server/api/index.ts`
- **Action:** Add the following export at the bottom of the file (or verify existence).

```typescript
// src/server/api/index.ts
// ... existing code ...

const api = new Elysia({ prefix: '/api/v1' });
// ... configuration ...

export default api;
export type App = typeof api; // <--- ADD THIS
```

### 2. Install Dependencies

Add the Eden library. Use `bun` as per project standards.

```bash
bun add @elysiajs/eden
```

### 3. Re-architect `src/lib/api-client.ts`

The current `fetcher` utility will be replaced by an initialized `edenFetch` instance.

#### A. Imports & Initialization

Replace the manual `BASE_URL` logic with Eden initialization.

```typescript
import { edenFetch } from '@elysiajs/eden';
import type { App } from '@/server/api'; // Import backend type

// Determine Base URL
// Note: In Next.js client-side, relative paths usually work for same-domain,
// but for SSR or specific environments, explicit full URL might be safer.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Initialize Typed Client
const client = edenFetch<App>(BASE_URL);
```

#### B. Error Handling Strategy (Adapter Pattern)

To avoid refactoring all 12+ UI files that catch `ApiClientError`, we will adapt Eden's error response to the existing error class.

```typescript
export class ApiClientError extends Error {
  constructor(
    public status: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Helper to handle Eden responses
// This keeps the "throw on error" behavior the current app expects
const handleEden = <T>({
  data,
  error
}: {
  data: T | null;
  error: any;
}): NonNullable<T> => {
  if (error) {
    // Eden returns specific error structures.
    // We assume 'value' contains the string message or JSON error from backend
    const status = error.status.toString();
    const message =
      typeof error.value === 'string'
        ? error.value
        : JSON.stringify(error.value);

    throw new ApiClientError(status, message);
  }
  return data as NonNullable<T>;
};
```

#### C. Method Refactoring

Refactor each exported function to use `client`.

**Example: `createLink`**

_Current:_

```typescript
export async function createLink(input: { url: string; ... }) {
  return fetcher('/links', { method: 'POST', body: JSON.stringify(input) });
}
```

_New (Eden):_

```typescript
export async function createLink(input: { url: string; ... }) {
    // client.api.v1.links.index.post is inferred from App type
    const response = await client.api.v1.links.post(input);
    return handleEden(response);
}
```

**Example: `deleteLink`**

_New (Eden):_

```typescript
export async function deleteLink(id: string) {
  const response = await client.api.v1.links({ id }).delete();
  return handleEden(response);
}
```

### 4. Verification Plan

1. **Type Check:** Run `bun type-check` to ensure `App` type is correctly resolved and `client` methods match the backend schema.
2. **Runtime Check:** Test the "Create Link" flow in the UI.
3. **Error Check:** Intentionally trigger an error (e.g., invalid URL) and verify `ApiClientError` is caught by the frontend Toast/ErrorBoundary.

## Notes

- **Authentication:** Eden handles headers differently. If `fetcher` was manually adding `Authorization`, ensure `edenFetch` is configured to forward cookies or headers if necessary (usually standard `fetch` credentials policy applies).
- **path parameters:** Eden uses function arguments for path parameters (e.g., `links({ id })`) differently than template literals.
