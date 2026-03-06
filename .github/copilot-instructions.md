# AI Coding Agent Instructions for urlfy.cc

## Project Overview

Self-hosted URL shortener. Bun runtime, Next.js 16 (App Router) frontend, ElysiaJS API backend, PostgreSQL 16 (Drizzle ORM), Redis 7 (Bun native client), OpenTelemetry → SigNoz.

## Code Style

- **Formatter/Linter**: Biome 2.2 only (no ESLint/Prettier). Run `bun run lint` to auto-fix.
- **TypeScript**: `strict: true`, `target: ES2017`. Each workspace owns its local `@/*` alias to its own `src/*`; cross-workspace sharing must go through `@urlfy/*` packages.
- **Imports**: `node:` prefix for Node builtins, `@/` for src, third-party first.
- **Files**: `kebab-case.ts`. Controllers: `camelCase`. Services: `PascalCase` object or named exports. Schemas: `PascalCase`.
- **Quotes**: Single. **Trailing commas**: None. **Indent**: 2 spaces.
- **Logging**: Use `createLogger('module-name')` from `@urlfy/telemetry` or the app-local telemetry re-export. Never `console.log`.

## Architecture

### Entry Points

| File                                         | Purpose                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/proxy.ts`                      | Next.js 16 proxy export: i18n routing + short URL detection → rewrites to `/r/{code}`                              |
| `apps/web/src/app/api/[[...slugs]]/route.ts` | API gateway: CORS, anti-abuse, rate-limit middleware → proxies `/api/*` to standalone `apps/api` over HTTP        |
| `apps/web/src/app/r/[code]/route.ts`         | Redirect hot path (Node.js runtime): local cache/domain resolution, password check, redirect depth, analytics emit |
| `apps/api/src/index.ts`                      | Standalone Bun entrypoint for the Elysia API service (`API_PORT`, default `3001`)                                  |
| `apps/api/src/server/index.ts`               | Main Elysia router (`/api` prefix) with plugins, models, controllers and Better-Auth mount                         |
| `apps/api/src/server/init.ts`                | API bootstrap: env validation → telemetry → DB health check → graceful shutdown                                     |
| `apps/worker/src/index.ts`                   | Separate Bun process for Redis Streams workers (analytics, aggregation, cleanup, deletion)                         |
| `apps/web/instrumentation.ts`                | Next.js instrumentation hook → imports `apps/web/src/server/init`                                                   |

### Module Structure (`apps/api/src/server/modules/{feature}/`)

Each module contains: `controller.ts` (Elysia instance), `service.ts` (pure logic), `schema.ts` (TypeBox + `.model()` registration), optional `services/` subfolder. See `src/server/modules/README.md`.

```
# Example: links module
apps/api/src/server/modules/links/
├── links.controller.ts    # new Elysia({ prefix: '/links' }).use(LinksModel)
├── links.service.ts       # export const LinkService = { createLink, listUserLinks, ... }
├── links.schema.ts        # TypeBox schemas + LinksModel Elysia model injection
├── services/              # Sub-services (create-link.ts, update-link.ts, etc.)
└── index.ts               # Barrel export
```

**Rules**: No cross-module internal imports. Shared services live in `src/server/services/`.

### Key Infrastructure

| Component  | Location                                                 | Notes                                                                                                          |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Database   | `packages/data/src/index.ts`                             | Bun native `SQL` class + `drizzle-orm/bun-sql`. Lazy proxy for test mocking. Pool: 20.                       |
| Schemas    | `packages/data/src/schema/`                              | Split by domain: `links.ts`, `auth.ts`, `analytics.ts`, `audit.ts`, etc.                                      |
| Redis      | `packages/cache/src/client.ts`                           | Bun native `RedisClient`. In-memory mock in `NODE_ENV=test`.                                                  |
| Cache keys | `packages/cache/src/keys.ts`                             | Centralized key builders: `CACHE_KEYS.LINK(code)`, negative cache, TTL constants.                             |
| Auth       | `apps/api/src/lib/auth.ts` + `apps/web/src/lib/auth.ts` | Better-Auth server/client split with shared auth utilities in `packages/auth-shared`.                         |
| Env        | `apps/*/src/lib/env.ts`                                  | Zod v4 validation per service. `SKIP_ENV_VALIDATION=1` during builds where required.                          |
| API client | `packages/contracts/src/api-client.ts`                   | Shared API client contract/types consumed by `apps/web/src/lib/api/*`; `apps/web` must not import `@urlfy/api`. |
| i18n       | `apps/web/src/i18n/routing.ts`                           | `next-intl`, locales: `['en', 'pt-br']`, `localePrefix: 'always'`.                                            |
| UI         | `apps/web/src/components/ui/`                            | Shadcn/UI (new-york style) + Radix primitives + Tailwind CSS 4.                                               |

### Auth Middleware Chain

- `requireAuth` → derives `user`/`session`, returns 401 if missing
- `requireAdmin` → extends `requireAuth`, checks `role === 'admin'` + 2FA enforced
- `optionalAuth` → derives auth context without blocking
- `requireApiKey` → validates API key with scope checking
- All support test bypass via `X-Test-User-Id` header

### API Response Envelope

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "LINK_NOT_FOUND", "message": "..." }, "requestId": "..." }
```

Errors use `AppError` class (`src/server/lib/error-handler.ts`) with `ErrorCode` enum.

## Build and Test

**Always use `bun`** — never npm/yarn/pnpm.

| Command                    | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `bun run docker:up`        | Start Postgres + Redis + GeoIP containers                    |
| `bun run docker:down`      | Stop containers                                              |
| `bun run dev`              | Start `web`, `api` and `worker` via Turborepo                |
| `bun run build`            | Build all workspaces (`web`, `api`, `worker`, packages)      |
| `bun run lint`             | Biome check + auto-fix                                       |
| `bun run type-check`       | `tsc --noEmit`                                               |
| `bun run test`             | Workspace-aware test orchestration via Turborepo             |
| `bun run test:unit`        | Unit suites across workspaces                                |
| `bun run test:integration` | Integration suites across workspaces                         |
| `bun run test:e2e`         | Playwright E2E tests                                         |
| `bun run test:coverage`    | Tests with coverage report                                   |
| `bun run db:generate`      | Generate Drizzle migrations (after schema edits)             |
| `bun run db:migrate`       | Run pending migrations                                       |
| `bun run db:push`          | Push schema directly (dev only)                              |
| `bun run db:seed`          | Seed reserved slugs                                          |

**Test setup**: each app owns its own `bunfig.toml` and `tests/setup.ts`; the root `bunfig.toml` intentionally has no preload. Run tests through workspace scripts or `turbo` so the correct setup file is applied.

## Project Conventions

### Elysia Patterns

- **1 Elysia instance = 1 controller** with `prefix`. Compose via `.use(subController)`.
- **Schemas**: Define with TypeBox `t.Object()`, infer types with `Static<typeof Schema>`. Register via `new Elysia().model({ 'name': Schema })` for OpenAPI `$ref`.
- **Services**: Pure functions or object aggregation — no HTTP context. Keep business logic out of controllers.
- **Tests**: Use `controller.handle(new Request(...))` for unit testing Elysia routes.

### Database

- Schemas in `packages/data/src/schema/` — single source of truth. Import `db` from `@urlfy/data`.
- Prefer `db.query.tableName.findFirst` unless raw SQL is needed for performance.
- After editing schemas, run `bun run db:generate` then `bun run db:migrate`.

### Workers

- Workers run as a separate Bun process (`apps/worker/src/index.ts`), NOT inside Next.js.
- Use `WorkerBase` abstract class (`apps/worker/src/server/lib/worker-base.ts`) for Redis Streams consumers.
- Analytics events emitted via Redis Streams (XADD), not direct DB writes on the hot path.

### Frontend

- Shared API client types live in `packages/contracts/src/api-client.ts`; web-side client wrappers live in `apps/web/src/lib/api/`.
- UI code should use the shared client helpers instead of importing API runtime code.
- React Query for server state. Form handling via `react-hook-form` + `@hookform/resolvers`.
- Dark mode default. CSP nonce propagated via `CspNonceProvider`.

## Security

- **Rate limiting**: Sliding window (Redis Sorted Sets) per IP/token/link. Config in `src/server/config/rate-limits.ts`.
- **Headers**: HSTS preload, X-Frame-Options DENY, CSP with nonces, Permissions-Policy denying camera/mic/geo/payment.
- **Auth**: Admin requires 2FA (TOTP). Cookies: `SameSite=strict`, `HttpOnly`, `Secure`. API keys prefixed `urlfy_sk_`.
- **Privacy**: IPs hashed with SHA-256 (never stored plaintext). Rotating weekly salt for visitor fingerprints.
- **Input sanitization**: `isomorphic-dompurify` for OG meta tags. URL validation with shortener/malicious domain blacklists.
- **CORS**: Restricted to configured domains only.
- **Redirect depth**: Max 3 hops via `X-Redirect-Depth` header, returns 421 if exceeded.
- **Idempotency**: `Idempotency-Key` header for POST operations (24h Redis TTL).

## Critical Rules

1. **Bun-first**: Use `Bun.password`, `Bun.file`, native SQL/Redis. No Node.js equivalents unless necessary.
2. **Window guard**: `if (typeof window === "undefined")` before server-side resource init (DB/Redis) to prevent build crashes.
3. **No OpenTelemetry in Edge/proxy code** — only Node.js runtime.
4. **No `console.log`** — use structured logger from `@/server/lib/telemetry`.
5. **No cross-module imports** — modules must not reach into other modules' internals.
6. **No traditional Next.js API routes** — all API logic goes through Elysia.
7. **Zod v4** (not v3) — uses `z.url()`, `z.email()` and other v4 APIs.
8. **`SKIP_ENV_VALIDATION=1`** during builds — env placeholders are injected automatically.
