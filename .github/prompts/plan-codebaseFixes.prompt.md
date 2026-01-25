# Implementation Plan: Codebase Remediation & Hardening

> **Context**: This plan addresses critical security vulnerabilities, architectural debt, and performance risks identified in `CODEBASE_ANALYSIS.md`.
> **Goal**: Achieve a "Healthy" codebase status (Score > 9/10), ensuring production readiness.

---

## Phase 1: Critical Security & Correctness (P0)

### 1.1 Fix Password Unlock Flow Contract

**Problem**: `redirect.middleware.ts` sends `passwordToken` in the body/headers, but the internal resolve logic (split between Next.js route and Controller) might expect `hasPasswordCookie` or handle it inconsistently. The analysis indicates a complete bypass of the unlock mechanism if not fixed.

**Target Files**:

- `src/server/middleware/redirect.middleware.ts`
- `src/server/modules/internal/internal.controller.ts` (This will be the Single Source of Truth)
- `src/app/api/internal/resolve/[code]/route.ts` (To be DELETED in Phase 2, but check logic first)

**Tasks**:

1.  **Middleware Update**: Ensure the middleware extracts the standard unlock cookie or token and passes it explicitly to the Internal API via a standard header (e.g., `x-password-token`) or ensures the cookie is forwarded.
2.  **Controller Logic**: Update `InternalController.resolve` to check for this token/cookie explicitly.
    ```typescript
    // draft logic for internal.controller.ts
    // Use proper typing for Headers and Cookies
    const passwordToken =
      headers['x-password-token'] || cookie['urlfy_unlock_token'];
    // Validate token against link.passwordHash if link is protected
    ```
3.  **Verification**: Add a test case ensuring a protected link returns 401 without token and 200 with valid token via the internal API.

### 1.2 Harden Internal Secrets

**Problem**: `INTERNAL_API_SECRET` defaults to `dev-secret` in `src/lib/env.ts` and is used as a fallback. This is dangerous for production.

**Target Files**:

- `src/lib/env.ts`

**Tasks**:

1.  **Remove Default**: Remove the fallback value `dev-secret` in the Zod schema for `INTERNAL_API_SECRET`.
2.  **Validation**: Ensure `env.ts` throws an error if `NODE_ENV === 'production'` and this secret is missing.
3.  **Separation**: Create `INTERNAL_ANALYTICS_SECRET` (or reuse `INTERNAL_API_SECRET` explicitly) to decouple from `BETTER_AUTH_SECRET` in `src/app/api/internal/analytics/route.ts`.

---

## Phase 2: Architectural Consolidation (P1)

### 2.1 Consolidate Internal Resolve Endpoint

**Problem**: Logic exists in both `src/app/api/internal/resolve/[code]/route.ts` (Next.js Route Handler) and `src/server/modules/internal/internal.controller.ts` (Elysia). Drift is inevitable.

**Target Files**:

- `src/app/api/internal/resolve/[code]/route.ts` (Delete)
- `src/server/modules/internal/internal.controller.ts` (Enhance)

**Tasks**:

1.  **Audit**: Compare the Next.js route logic against the Elysia controller. Identify missing validation or headers in the controller.
2.  **Port**: Move any missing logic (e.g., specific telemetry tags, edge-case error handling) to `internal.controller.ts`.
3.  **Switchover**: Ensure `redirect.middleware.ts` calls the correct URL structure.
4.  **Delete**: Remove `src/app/api/internal/resolve/[code]/route.ts`.

### 2.2 Remove Legacy Service Layer

**Problem**: `src/server/services/link.service.ts` overlaps with `src/server/modules/links/links.service.ts`.

**Target Files**:

- `src/server/services/link.service.ts`
- `src/server/modules/links/links.service.ts`
- **Global Search**: Find imports from `@/server/services/link.service`.

**Tasks**:

1.  **Verify Parity**: Ensure `modules/links/links.service.ts` has all methods present in the legacy service.
2.  **Refactor Imports**: Update all call sites to import from the module-based service.
3.  **Delete**: Remove `src/server/services/link.service.ts`.

---

## Phase 3: Performance & Optimization (P2)

### 3.1 Replace Redis `KEYS` with `SCAN`

**Problem**: `cache.service.ts` uses `keys()` which blocks the Redis thread. Dangerous at scale.

**Target Files**:

- `src/server/services/cache.service.ts`

**Tasks**:

1.  **Refactor**: Implement a utility method `scanKeys(pattern: string): Promise<string[]>` using a cursor-based approach.
    ```typescript
    async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');
      return keys;
    }
    ```
2.  **Apply**: Replace usage in `invalidate...` methods.

### 3.2 Accurate Cache-Hit Signals

**Problem**: Edge middleware builds `X-Cache` based on latency heuristics.

**Target Files**:

- `src/server/modules/internal/internal.controller.ts`
- `src/server/middleware/redirect.middleware.ts`

**Tasks**:

1.  **Expose State**: In `InternalController.resolve`, return an explicit response header `X-Internal-Cache-Status: HIT` or `MISS` based on whether the data came from Redis or DB.
2.  **Consume**: specific Update `redirect.middleware.ts` to read this header from the upstream response and set the final client-facing `X-Cache` header accordingly, removing the latency time check.

---

## Phase 4: Maintainability & Code Quality (P3)

### 4.1 Standardize Logging

**Problem**: Mixed usage of `console.log`, `console.error`, and structured telemetry.

**Target Files**:

- `src/server/services/url-validator.ts`
- `src/server/services/qr.service.ts`
- `src/server/lib/logger.ts` (assuming existence, or verify `src/lib/logger.ts`)

**Tasks**:

1.  **Import Logger**: Ensure the project's standard logger (likely Pino or similar integrated with OpenTelemetry) is available.
2.  **Replace**:
    - `console.error(...)` -> `logger.error({ error, context }, 'message')`
    - `console.log(...)` -> `logger.info({ context }, 'message')`
3.  **Typing**: Ensure log context objects are strongly typed.

---

## Phase 5: Testing (P3)

### 5.1 Complete E2E Test Suite

**Problem**: "TODO" placeholders in `tests/e2e/ui.spec.ts`.

**Target Files**:

- `tests/e2e/ui.spec.ts`
- `tests/e2e/helpers.ts`

**Tasks**:

1.  **Implement Helpers**: Finish the login/auth helpers in `helpers.ts` to support programmatic login or UI-based login.
2.  **Fill Scenarios**:
    - **Link Creation**: Automate clicking "Create Link", filling the URL, and verifying the result row.
    - **Date Picker**: Implement the interaction with the date picker component for expiration tests.
3.  **Strict Selectors**: Use `data-testid` where available, or stable accessibility attributes (roles/labels).

---

## Execution Constraints

- **Type Safety**: strict `noExplicitAny` must be respected. Use `zod` or `TypeBox` schemas for validation.
- **Atomic Commits**: Each sub-task (e.g., 2.1, 2.2) should be verifiable independently.
- **Verification**: Run `bun test` after purely logic changes.
