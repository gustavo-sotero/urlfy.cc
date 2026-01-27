# Implementation Plan: Codebase Security Hardening & Refactoring

**Target:** `urlfy.cc` Codebase
**Date:** 2026-01-26
**Based on:** `CODEBASE_ANALYSIS.md`

This document outlines the technical steps to resolve high-priority security risks and improve codebase maintainability. All changes must adhere to strict TypeScript standards (`no-explicit-any`), utilize strict validation (TypeBox/Zod), and follow the project's existing patterns (Elysia for API, Next.js for Edge).

---

## 1. Security: Fix Host Header Injection in Redirect Middleware

**Risk:** The current implementation constructs internal API calls using `request.nextUrl.origin`. If the Host header is spoofed, this directs traffic to an attacker-controlled origin while carrying the `INTERNAL_API_SECRET`.

**File:** `src/server/middleware/redirect.middleware.ts`

**Tasks:**

1.  **Define Trusted Origin:**
    - Instantiate a safe base URL constant. Prefer `http://127.0.0.1:3000` (or `process.env.INTERNAL_API_URL` if available) for server-side fetches to avoid network hairpin traversal.
    - Alternatively, using `process.env.NEXT_PUBLIC_APP_URL` as a fallback, but ensuring it is validated.

2.  **Refactor Fetch Calls:**
    - Replace all instances of `fetch(${request.nextUrl.origin}/api/internal/...)` with `fetch(${INTERNAL_API_BASE}/api/internal/...)`.

3.  **Validate Host Header (Optional but recommended):**
    - In the middleware entry, check if `request.headers.get('host')` matches the allowed domain list (production only).

**Code Block Example:**

```typescript
const INTERNAL_API_BASE =
  process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000';

// Usage
const response = await fetch(`${INTERNAL_API_BASE}/api/internal/analytics`, {
  headers: {
    'x-internal-secret': process.env.INTERNAL_API_SECRET
  }
});
```

---

## 2. Consistency: Unify Client IP Extraction

**Risk:** Different middleware components (Anti-Abuse, Rate-Limit, Redirect) use divergent logic to determine client IP, leading to inconsistent enforcement and potential bypasses via IP spoofing.

**New File:** `src/server/lib/ip.ts`

**Tasks:**

1.  **Create Helper Function:**
    - Implement `export function getClientIp(request: Request): string`.
    - Logic:
      1.  Check `CF-Connecting-IP` (Cloudflare).
      2.  Check `X-Real-IP` (Nginx/standard proxy).
      3.  Check `X-Forwarded-For` (parse first ID).
      4.  Fallback to `127.0.0.1` (development) or throw/log warning in prod.
    - Ensure return type is strictly `string`.

2.  **Update Consumers:**
    - **`src/server/middleware/anti-abuse.ts`**: Replace fallback logic with `getClientIp(req)`.
    - **`src/server/middleware/rate-limit.ts`**: Replace custom parsing logic.
    - **`src/server/middleware/redirect.middleware.ts`**: Replace inline extraction.

---

## 3. Config: Single-Source CORS Policy

**Risk:** Definitions exist in `src/server/config/plugins.ts` (Elysia) and `src/server/middleware/cors.ts` (Next.js Edge), causing policy drift.

**New File:** `src/server/config/cors.ts`

**Tasks:**

1.  **Centralize Configuration:**
    - Export constants:
      - `ALLOWED_ORIGINS`: string[] (e.g., `['https://urlfy.cc', 'http://localhost:3000']`).
      - `ALLOWED_METHODS`: string[].
      - `ALLOWED_HEADERS`: string[].
      - `MAX_AGE`: number.
    - Export a helper `isOriginAllowed(origin: string): boolean`.

2.  **Refactor Next.js Middleware:**
    - File: `src/server/middleware/cors.ts`
    - Import configuration from `src/server/config/cors.ts`.
    - Simplify logic to use the imported constants.

3.  **Refactor Elysia Plugin:**
    - File: `src/server/config/plugins.ts`
    - Update `cors()` plugin initialization to use the shared configuration.

---

## 4. Maintenance: Resolve TODOs

**Context:** The codebase contains legacy TODO markers for background processing and error reporting.

### Part A: Activate Analytics Queue

**File:** `src/server/jobs/scheduler.ts`

**Tasks:**

1.  Locate the TODO regarding `analytics-queue` / Redis Streams.
2.  Implement the logic to push aggregation jobs to the stream manually if not automated via BullMQ repetition, or verify the BullMQ setup.
3.  Remove dead code/comments referencing the "old queue system".

### Part B: Client-Side Error Tracking

**Files:** `src/components/error-boundary.tsx`, `src/app/api/monitor/log/route.ts` (New)

**Tasks:**

1.  **Create Log Endpoint:**
    - Create `src/app/api/monitor/log/route.ts`.
    - Method: POST.
    - Body: `{ error: string, componentStack?: string, url: string }`.
    - Action: Log to server-side interface (console/SigNoz) with severty `error`.
2.  **Update Error Boundary:**
    - In `src/components/error-boundary.tsx`, inside `componentDidCatch` or `onError`, replace the TODO with a `fetch('/api/monitor/log', ...)` call.
    - Ensure this call is non-blocking (fire and forget).

---

## 5. Refactoring: Split Large Link Controller

**Constraint:** `src/server/modules/links/links.controller.ts` combines validation, public access, private management, and stats in one file.

**Tasks:**

1.  **Create Sub-Controllers directory:** `src/server/modules/links/controllers/`.
2.  **Extract Logic:**
    - `public.controller.ts`: URL Validation, Resolution, Public Metadata.
    - `protected.controller.ts`: Create, Update, Delete, List (Authenticated).
    - `stats.controller.ts`: Analytics endpoints.
3.  **Re-Compose:**
    - Update `src/server/modules/links/links.controller.ts` to instantiate and combine these sub-controllers using `.use(publicController).use(protectedController)...`.
    - Ensure all TypeBox models are correctly registered in the parent scope or re-imported.

---

## General Constraints

- **Type Safety:** No usages of `any`. Use `unknown` with validation checks if necessary.
- **Imports:** Use `@/` path aliases for all internal imports.
- **Testing:** Ensure `bun test` passes after refactoring.
