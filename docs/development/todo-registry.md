# TODO Registry

## Codebase Analysis Followup Remediations

- **Tracking ID:** TODO-CODEBASE-ANALYSIS-FOLLOWUP-2026-03-10
- **Status:** Resolved
- **Resolved date:** 2026-03-10
- **Changes delivered:**
  1. **2FA silent failure** — `GET /auth/two-factor/status` catch block that returned `success:true` on internal errors removed; errors now propagate to global error handler.
  2. **Build-time sentinel rejection** — `packages/auth-shared/src/auth-config.ts` now owns Better-Auth secret validation; `apps/api/src/lib/auth.config.ts` and `apps/web/src/lib/auth.config.ts` are re-export shims.
  3. **Scopes single source of truth** — `hasScopes`, `ScopePresets`, `parseScopes`, `serializeScopes`, `isValidScope` added to `packages/auth-shared/src/scopes.ts`; duplicate removed; `apps/api/src/server/config/scopes.ts` is now a re-export shim.
  4. **Rate-limits canonical policy + evaluator** — `packages/contracts/src/rate-limit-policy.ts` is the single policy registry and `packages/cache/src/rate-limiter-core.ts` is the single evaluator; both app copies are now adapter shims.
  5. **CORS/security-headers canonical policy** — `packages/contracts/src/cors-policy.ts` and `packages/contracts/src/security-headers.ts` created; all four app copies replaced with re-export shims.
  6. **Browser error reporting** — `apps/web/src/lib/browser-logger.ts` and `apps/web/src/lib/browser-log-contract.ts` now define the canonical client payload; key dashboard/admin/form surfaces and `/api/monitor/log` all use the same requestId/context-aware contract.
  7. **Redis import-time capture** — `packages/cache/src/distributed-lock.ts` changed from module-level `const redis = getRedisClient()` to lazy `getRedis()` accessor.
  8. **Dead suppression removed** — `@ts-ignore` and `biome-ignore` comments removed from `apps/api/src/server/index.ts` (`noEmit: true` means TS4023 never fires).
  9. **Biome CSS** — `biome.json` extended with `css.parser.tailwindDirectives: true` to handle Tailwind v4 `@theme`, `@custom-variant`, `@apply` syntax.
  10. **Web env validation** — `apps/web/src/server/init.ts` now calls `validateEnv()` before telemetry init, surfacing misconfiguration at startup.

---

## Analytics Provider Selection

- **Location:** `src/lib/hooks/use-analytics-consent.ts`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-ANALYTICS-PROVIDER-SELECTION
- **Status:** Open
- **Context:** Script injection is intentionally deferred until a production analytics vendor is selected.
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