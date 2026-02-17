# AI Coding Agent Instructions for urlfy.cc

## Project Overview

Self-hosted URL shortener. Bun runtime, Next.js 16 (App Router) frontend, ElysiaJS API backend, PostgreSQL 16 (Drizzle ORM), Redis 7 (Bun native client), OpenTelemetry → SigNoz.

## Code Style

- **Formatter/Linter**: Biome 2.2 only (no ESLint/Prettier). Run `bun run lint` to auto-fix.
- **TypeScript**: `strict: true`, `target: ES2017`. Path alias `@/*` → `./src/*`.
- **Imports**: `node:` prefix for Node builtins, `@/` for src, third-party first.
- **Files**: `kebab-case.ts`. Controllers: `camelCase`. Services: `PascalCase` object or named exports. Schemas: `PascalCase`.
- **Quotes**: Single. **Trailing commas**: None. **Indent**: 2 spaces.
- **Logging**: Use `createLogger('module-name')` from `@/server/lib/telemetry`. Never `console.log`.

## Architecture

### Entry Points

| File                                | Purpose                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                      | Next.js 16 proxy export: i18n routing + short URL detection → rewrites to `/r/{code}`                               |
| `src/app/api/[[...slugs]]/route.ts` | API gateway: CORS, anti-abuse, rate-limit middleware → Elysia `api.handle(request)`                                 |
| `src/app/r/[code]/route.ts`         | Redirect hot path (Node.js runtime): cache lookup, password check, redirect depth, analytics emit via Redis Streams |
| `src/server/index.ts`               | Main Elysia router (`/api` prefix) with all plugins, models, controllers, Better-Auth mount                         |
| `src/server/init.ts`                | Server bootstrap: env validation → telemetry → DB health check → graceful shutdown                                  |
| `src/workers.ts`                    | Separate Bun process for Redis Streams workers (analytics, aggregation, cleanup, deletion)                          |
| `instrumentation.ts`                | Next.js instrumentation hook → imports `@/server/init`                                                              |

### Module Structure (`src/server/modules/{feature}/`)

Each module contains: `controller.ts` (Elysia instance), `service.ts` (pure logic), `schema.ts` (TypeBox + `.model()` registration), optional `services/` subfolder. See `src/server/modules/README.md`.

```
# Example: links module
src/server/modules/links/
├── links.controller.ts    # new Elysia({ prefix: '/links' }).use(LinksModel)
├── links.service.ts       # export const LinkService = { createLink, listUserLinks, ... }
├── links.schema.ts        # TypeBox schemas + LinksModel Elysia model injection
├── services/              # Sub-services (create-link.ts, update-link.ts, etc.)
└── index.ts               # Barrel export
```

**Rules**: No cross-module internal imports. Shared services live in `src/server/services/`.

### Key Infrastructure

| Component  | Location                             | Notes                                                                                                          |
| ---------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Database   | `src/db/index.ts`                    | Bun native `SQL` class + `drizzle-orm/bun-sql`. Lazy proxy for test mocking. Pool: 20.                         |
| Schemas    | `src/db/schema/`                     | Split by domain: `links.ts`, `auth.ts`, `analytics.ts`, `audit.ts`, etc.                                       |
| Redis      | `src/server/lib/redis/redis.ts`      | Bun native `RedisClient`. In-memory mock in `NODE_ENV=test`.                                                   |
| Cache keys | `src/server/lib/cache-keys.ts`       | Centralized key builders: `CACHE_KEYS.LINK(code)`, TTL constants.                                              |
| Auth       | `src/lib/auth.ts` + `auth.config.ts` | Better-Auth with Drizzle adapter, `twoFactor`/`admin`/`apiKey`/`openAPI` plugins, Argon2id via `Bun.password`. |
| Env        | `src/lib/env.ts`                     | Zod v4 validation. `SKIP_ENV_VALIDATION=1` during `next build`.                                                |
| API client | `src/lib/api/client.ts`              | Eden Treaty (`treaty<App>`) for type-safe client → server calls.                                               |
| i18n       | `src/i18n/routing.ts`                | `next-intl`, locales: `['en', 'pt-br']`, `localePrefix: 'always'`.                                             |
| UI         | `src/components/ui/`                 | Shadcn/UI (new-york style) + Radix primitives + Tailwind CSS 4.                                                |

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
| `bun run dev`              | Next.js dev + worker process (concurrently)                  |
| `bun run build`            | Production build (`SKIP_ENV_VALIDATION=1` set automatically) |
| `bun run lint`             | Biome check + auto-fix                                       |
| `bun run type-check`       | `tsc --noEmit`                                               |
| `bun run test`             | All tests (unit + integration + perf + security)             |
| `bun run test:unit`        | `bun test src/ tests/unit/`                                  |
| `bun run test:integration` | `bun test tests/integration/`                                |
| `bun run test:e2e`         | Playwright E2E tests                                         |
| `bun run test:coverage`    | Tests with coverage report                                   |
| `bun run db:generate`      | Generate Drizzle migrations (after schema edits)             |
| `bun run db:migrate`       | Run pending migrations                                       |
| `bun run db:push`          | Push schema directly (dev only)                              |
| `bun run db:seed`          | Seed reserved slugs                                          |

**Test setup**: `tests/setup.ts` (preloaded via `bunfig.toml`). Uses `bun:test` runner, Happy-DOM for React, `.env.test` for secrets. Test files: `**/__tests__/*.test.ts`, `tests/unit/*.test.ts[x]`, `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts`.

## Project Conventions

### Elysia Patterns

- **1 Elysia instance = 1 controller** with `prefix`. Compose via `.use(subController)`.
- **Schemas**: Define with TypeBox `t.Object()`, infer types with `Static<typeof Schema>`. Register via `new Elysia().model({ 'name': Schema })` for OpenAPI `$ref`.
- **Services**: Pure functions or object aggregation — no HTTP context. Keep business logic out of controllers.
- **Tests**: Use `controller.handle(new Request(...))` for unit testing Elysia routes.

### Database

- Schemas in `src/db/schema/` — single source of truth. Import `db` from `@/db`.
- Prefer `db.query.tableName.findFirst` unless raw SQL is needed for performance.
- After editing schemas, run `bun run db:generate` then `bun run db:migrate`.

### Workers

- Workers run as separate Bun process (`src/workers.ts`), NOT inside Next.js.
- Use `WorkerBase` abstract class (`src/server/lib/worker-base.ts`) for Redis Streams consumers.
- Analytics events emitted via Redis Streams (XADD), not direct DB writes on the hot path.

### Frontend

- Eden Treaty client for API calls — never raw `fetch` to own API.
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
