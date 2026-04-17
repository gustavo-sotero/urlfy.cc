# Monorepo API/Web Decoupling Status

> Base plan: `.github/prompts/plan-monorepoApiFrontendDecoupling.prompt.md`

## Scope

This document records the implementation status of the API/frontend decoupling plan for the Bun Workspaces + Turborepo architecture.

Non-negotiable constraints preserved:

- Redirect hot path stays local in `apps/web` (no sync `web -> api` hop for `/:code` resolution).
- API runs as standalone service in `apps/api`.
- Worker runs as standalone service in `apps/worker`.
- Shared logic lives in `packages/*`.

## Stage Matrix

| Stage | Status | Evidence |
| --- | --- | --- |
| Stage 0 - Baseline + regression gate | Implemented | `docs/development/redirect-performance-baseline.md`, `load/k6/redirect-hot-path.js` |
| Stage 1 - Workspaces + Turbo graph | Implemented | `package.json`, `turbo.json` |
| Stage 2 - Shared packages extraction | Implemented | `packages/contracts`, `packages/data`, `packages/cache`, `packages/telemetry` |
| Stage 3 - Redirect domain extraction | Implemented | `packages/redirect-domain/src/index.ts`, `packages/redirect-domain/src/service.ts`, `packages/redirect-domain/src/types.ts` |
| Stage 4 - Web redirect rewire | Implemented | `apps/web/src/app/r/[code]/route.ts`, `apps/web/src/proxy.ts` |
| Stage 5 - Standalone API service | Implemented | `apps/api/src/index.ts`, `docker/api.Dockerfile` |
| Stage 6 - Standalone worker service | Implemented | `apps/worker/src/index.ts`, `docker/worker.Dockerfile` |
| Stage 7 - `/api/*` same-origin ingress routing | Implemented | `next.config.ts` (dev rewrite), Traefik path-based routing (prod), `apps/api` owns all `/api/*` |
| Stage 8 - TS/Biome workspace config | Implemented | `packages/config-ts`, `packages/config-biome`, `biome.json` |
| Stage 9 - Docker multi-service topology | Implemented | `docker/docker-compose.prod.yml`, `docker/web.Dockerfile`, `docker/api.Dockerfile`, `docker/worker.Dockerfile` |
| Stage 10 - CI workspace-aware pipeline | Implemented | `.github/workflows/ci.yml` |
| Stage 11 - Guardrails + docs hardening | Implemented | `scripts/validate-module-boundaries.ts`, `docs/development/rollback-runbook.md`, `docs/development/ownership-matrix.md` |

## Redirect Invariants

Redirect behavior implemented in the current split:

- Cache-aside resolution with Redis first and DB fallback.
- Negative cache for missing links.
- Depth control via `X-Redirect-Depth` (max 3).
- Validation of `isActive`, `isBanned`, `expiresAt`, `maxClicks`, password unlock.
- Fire-and-forget analytics dispatch via Redis Streams.
- Explicit adapter contracts for cache/db/lock/circuit-breaker dependencies plus an object-based resolve input with `requestMeta`.

Primary files:

- `apps/web/src/app/r/[code]/route.ts`
- `packages/redirect-domain/src/service.ts`
- `packages/redirect-domain/src/fetcher.ts`
- `packages/redirect-domain/src/validator.ts`

## Validation Snapshot (2026-03-06)

Quality and security gates executed successfully:

- `bun run lint`
- `bun run type-check`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:security`
- `bun run security:audit`
- `bun run security:scan`

Observed results from this validation cycle:

- Lint: no Biome issues and no boundary violations.
- Type-check: all workspace packages passed.
- Frontend API typing: `apps/web` now consumes a shared client contract from `packages/contracts/src/api-client.ts` instead of a local generic Eden stub.
- Unit tests: all suites passed (`api`, `web`, `worker`, `redirect-domain`, `telemetry`).
- Integration/security suites: passed; infra-dependent scenarios were explicitly skipped by tests when dependencies were unavailable.
- Dependency security: no vulnerabilities reported by `bun audit --production` and `snyk test`.

Performance evidence captured from existing perf tests:

- API analytics perf (`apps/api/tests/perf/analytics.perf.test.ts`): P99 observed at 30ms in current test run.
- Web perf (`apps/web/tests/perf/navbar-performance.test.ts`): component perf tests passed.
- Redirect load harness is now tracked in `load/k6/redirect-hot-path.js` and documented in `docs/development/redirect-performance-baseline.md`.

## Known Follow-ups (Non-blocking to Decoupling)

- `TODO-DUAL-AUTH-BOUNDARY` in `docs/development/todo-registry.md`: dual Better-Auth instantiation remains an intentional trade-off.

## Shared Configuration Consolidation (2026-03-10)

The following shared runtime configuration objects were extracted from per-app duplicates into `packages/contracts` and `packages/auth-shared`:

| Previous location (duplicated)                                  | Canonical source                                    |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `apps/api/src/lib/auth.config.ts`                               | `packages/auth-shared/src/auth-config.ts`           |
| `apps/web/src/lib/auth.config.ts`                               | `packages/auth-shared/src/auth-config.ts`           |
| `apps/api/src/server/config/cors.ts`                            | `packages/contracts/src/cors-policy.ts`             |
| `apps/web/src/server/config/cors.ts`                            | `packages/contracts/src/cors-policy.ts`             |
| `apps/api/src/server/config/security.ts`                        | `packages/contracts/src/security-headers.ts`        |
| `apps/web/src/server/config/security.ts`                        | `packages/contracts/src/security-headers.ts`        |
| `apps/api/src/server/config/rate-limits.ts`                     | `packages/contracts/src/rate-limit-policy.ts`       |
| `apps/web/src/server/config/rate-limits.ts`                     | `packages/contracts/src/rate-limit-policy.ts`       |
| `apps/api/src/server/config/scopes.ts` (local `hasScopes`, etc) | `packages/auth-shared/src/scopes.ts`                |

App-local files (`apps/api/src/server/config/…`, `apps/web/src/server/config/…`) are now pure
re-export shims — they preserve existing import paths for consumers while the actual logic lives
in the shared packages.

The same shim pattern now applies to `apps/api/src/lib/auth.config.ts` and
`apps/web/src/lib/auth.config.ts`, which both re-export the canonical Better-Auth
config primitives from `packages/auth-shared/src/auth-config.ts`.

Additional hardening completed in this cycle:
- `GET /api/auth/two-factor/status` silent failure fixed (catch returning `success:true` removed).
- Build-time sentinel rejection added to both `auth.config.ts` files.
- Duplicate `hasScopes` implementation removed from `packages/auth-shared`.
- Rate-limiter evaluator is now canonical in `packages/cache/src/rate-limiter-core.ts`; `apps/api/src/server/lib/rate-limiter.ts` and `apps/web/src/server/lib/rate-limiter.ts` are adapter shims.
- `packages/cache/src/distributed-lock.ts` now resolves the Redis client lazily (no import-time capture).
- `@ts-ignore` / `biome-ignore` removed from `apps/api/src/server/index.ts` export (dead suppression with `noEmit:true`).
- `biome.json` extended with `css.parser.tailwindDirectives: true` to support Tailwind v4 syntax.
- `apps/web/src/server/init.ts` now calls `validateEnv()` at startup to surface misconfiguration early.
- Browser-side error reporting centralized in `apps/web/src/lib/browser-logger.ts`.

## Shared Runtime Service Consolidation (2026-03-12)

The following runtime services were consolidated from per-app duplicates into canonical shared packages. App-local files are now thin re-export shims. Parity is enforced by `apps/api/tests/unit/shared-runtime-parity.test.ts`.

| Previous location (duplicated)                                   | Canonical source                                   |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `apps/api/src/server/services/cache.service.ts`                 | `packages/redirect-domain/src/cache-service.ts`    |
| `apps/worker/src/server/services/cache.service.ts`              | `packages/redirect-domain/src/cache-service.ts`    |
| `apps/api/src/server/services/metrics.service.ts`               | `packages/cache/src/metrics-service.ts`            |
| `apps/web/src/server/services/metrics.service.ts`               | `packages/cache/src/metrics-service.ts`            |
| `apps/worker/src/server/services/metrics.service.ts`            | `packages/cache/src/metrics-service.ts`            |
| `apps/api/src/server/services/anti-abuse.service.ts`            | `packages/cache/src/anti-abuse-service.ts`         |
| `apps/web/src/server/services/anti-abuse.service.ts`            | `packages/cache/src/anti-abuse-service.ts`         |
| `apps/api/src/emails/types.ts`                                  | `packages/email/src/types.ts`                      |
| `apps/web/src/emails/types.ts`                                  | `packages/email/src/types.ts`                      |
| `apps/api/src/emails/render.ts`                                 | `packages/email/src/render.ts`                     |
| `apps/web/src/emails/render.ts`                                 | `packages/email/src/render.ts`                     |
| `apps/api/src/server/lib/email.ts`                              | `packages/email/src/transport.ts`                  |
| `apps/web/src/server/lib/email.ts`                              | `packages/email/src/transport.ts`                  |
| `apps/api/src/server/lib/locale.ts`                             | `packages/email/src/locale.ts`                     |
| `apps/web/src/server/lib/locale.ts`                             | `packages/email/src/locale.ts`                     |
| `apps/api/src/server/services/email.service.ts`                 | `packages/email/src/email-service.ts`              |
| `apps/web/src/server/services/email.service.ts`                 | `packages/email/src/email-service.ts`              |

Additional hardening in this cycle:
- `requireAuth` middleware now throws `AppError(SERVICE_UNAVAILABLE)` on auth subsystem failure instead of silently treating it as unauthenticated.
- `optionalAuth` middleware now logs auth subsystem failures while preserving anonymous continuation.
- Monitor log endpoint (`/ops/monitor/log`) switched from in-memory rate limiter to distributed Redis-backed rate limiting via canonical `rateLimiter`.
- Admin layout IP extraction uses canonical `getClientIpFromHeaders()` instead of direct proxy-header parsing.
- `security-report.ts` classifier distinguishes upstream unavailability (503) from actual control failures.
- Proxy-header guardrail script (`scripts/validate-proxy-headers.ts`) added to CI.
