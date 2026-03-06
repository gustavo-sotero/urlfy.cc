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
| Stage 7 - `/api/*` gateway over network boundary | Implemented | `apps/web/src/app/api/[[...slugs]]/route.ts` |
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
