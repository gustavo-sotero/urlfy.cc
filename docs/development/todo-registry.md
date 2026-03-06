# TODO Registry

## Analytics Provider Selection

- **Location:** `src/lib/hooks/use-analytics-consent.ts`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-ANALYTICS-PROVIDER-SELECTION
- **Status:** Open
- **Context:** Script injection is intentionally deferred until a production analytics vendor is selected.
---

## Eden Treaty Route-Level Type Safety

- **Location:** `apps/web/src/lib/api/api-types.ts`, `apps/web/tsconfig.json`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-EDEN-TREATY-TYPES
- **Status:** Open
- **Context:** `apps/web` uses a generic `Elysia<'/api', any>` stub as the `App` type for Eden Treaty.
  This loses per-endpoint type safety (request/response schemas not inferred).
  The root cause is that TypeScript cannot resolve `@urlfy/api/types` (which imports Elysia server code)
  from inside `apps/web` without building `apps/api` first, creating a chicken-and-egg dependency.
- **Resolution path:**
  1. Build `apps/api` as a compiled TypeScript project before web (`cd apps/api && bunx tsc --build`).
  2. Remove the `@urlfy/api/types` path override from `apps/web/tsconfig.json`.
  3. Import the real `App` type from `@urlfy/api/types` in `api-types.ts`.
  4. Remove the `biome-ignore` comment and the `app/dist` copy from `docker/web.Dockerfile`.

---

## Dual Better-Auth Instantiation (Architectural Decision)

- **Location:** `apps/web/src/lib/auth.ts`, `apps/api/src/lib/auth.ts`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-DUAL-AUTH-BOUNDARY
- **Status:** Intentional — documented here as a known trade-off
- **Context:** Both `apps/web` and `apps/api` instantiate independent `betterAuth` instances sharing
  the same `BETTER_AUTH_SECRET` and `DATABASE_URL`. This allows `apps/web` to validate sessions in
  RSC layouts without an extra network hop to `apps/api` (important for SSR performance), while
  `apps/api` handles all auth mutations (sign-in, sign-up, OAuth callbacks, 2FA, API keys).
  As a consequence, `apps/web` directly holds `DATABASE_URL`, `BETTER_AUTH_SECRET`, and OAuth credentials.
- **Trade-offs to revisit:**
  - Secret surface in web container (database credential + auth secret required in addition to API client).
  - Two email service instances (`apps/web/src/server/lib/email.ts` and `apps/api/src/lib/email.ts`)
    that must be kept in sync when email templates or providers change.
  - Any new Better-Auth plugin must be added to both `auth.ts` files.
- **Revisit when:** Performance budget allows an API call for session validation, or when auth
  complexity warrants isolating all auth state to `apps/api`.