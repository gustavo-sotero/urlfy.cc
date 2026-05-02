# urlfy.cc

Self-hosted URL shortener built as a portfolio project — applied research in Bun, React 19, Next.js 16, ElysiaJS, and operational trade-offs.

## What Exists

- Next.js 16 + React 19 web app: localized public pages, auth flows, dashboard, and redirect hot path
- ElysiaJS API at `/api/*` with interactive docs at `/api/docs`
- Bun worker for analytics, cleanup, and async jobs
- Shared packages for contracts, cache, data, auth, telemetry, and redirect-domain logic
- Docker-based local and production topologies

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Bun 1.x+ | Native SQL and Redis APIs |
| Frontend | Next.js 16 App Router | SSR, RSC, Edge proxy |
| API | ElysiaJS (`apps/api`, :3001) | Shared contracts via `@urlfy/contracts` |
| Database | PostgreSQL 16+ | Drizzle ORM + Bun SQL |
| Cache / Queue | Redis 7+ | `Bun.RedisClient` (RESP3), Redis Streams |
| Auth | Better-Auth | OAuth (Google, GitHub); admin via `ADMIN_GITHUB_ACCOUNT_ID` |
| Geo | GeoLite2 via jsDelivr | No credentials required |
| Observability | Grafana LGTM + OTLP | OpenTelemetry: logs, traces, metrics |
| Styling | Tailwind CSS + shadcn/ui | |
| Monorepo | Bun Workspaces + Turborepo | Incremental build graph |

## Topology

```text
Browser
  -> :3000 (same-origin)
       /api/*     -> apps/api  (ElysiaJS, :3001)
       /r/:code   -> apps/web  redirect hot path (no HTTP hop)
       /*         -> apps/web  (Next.js pages)

Background
  -> apps/worker  (Redis Streams consumers)
```

Local dev: `next.config.ts` rewrites keep everything same-origin.  
Production: Traefik routes `/api/*` to `apps/api`; `/r/:code` stays in `apps/web`.

## Monorepo Layout

```
apps/
  web/     Next.js 16 App Router — public pages, auth, dashboard, /r/[code]
  api/     ElysiaJS REST API — all /api/* endpoints
  worker/  Bun workers — analytics aggregation, cleanup, deferred deletion
packages/
  contracts/       Shared envelopes, error codes, rate-limit & CORS policies
  redirect-domain/ Cache-aside resolve logic (no framework coupling)
  data/            Drizzle schema + Bun SQL client
  cache/           Redis client, cache keys, circuit breaker, rate-limiter core
  telemetry/       OpenTelemetry helpers, canonical IP derivation
  auth-shared/     Better-Auth config primitives, scopes
  config-ts/       Base tsconfig presets
docker/
  docker-compose.yml        Dev: PostgreSQL + Redis + GeoIP downloader
  docker-compose.apps.yml   Local multi-service overlay
  docker-compose.prod.yml   Production: migrate + web + api + worker
```

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) `1.3.11+`, Docker with Compose

```bash
git clone https://github.com/gustavo-sotero/urlfy.cc.git
cd urlfy.cc
bun install
bun run docker:up
```

Copy `.env.example` → `.env` and set at minimum:

```
DATABASE_URL
BETTER_AUTH_SECRET
INTERNAL_API_SECRET
ADMIN_GITHUB_ACCOUNT_ID
```

```bash
bun run db:migrate
bun run db:seed
bun run dev
```

| URL | Service |
|---|---|
| `http://localhost:3000` | Web app |
| `http://localhost:3000/api/docs` | API docs (same-origin) |
| `http://localhost:3001/api/docs` | API docs (direct) |
| `http://localhost:3001/api/health/ready` | Readiness probe |

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Start web + api + worker (Turborepo) |
| `bun run dev:web` / `dev:api` / `dev:worker` | Start individual service |
| `bun run lint` | Biome lint pipeline |
| `bun run type-check` | Type-check all workspaces |
| `bun run test` | All test suites |
| `bun run test:unit` / `test:integration` / `test:e2e` | Scoped test runs |
| `bun run scripts/run-k6.ts k6/redirect-hot-path.js` | Redirect hot-path load check (requires k6) |
| `bun run docker:up` | Start PostgreSQL + Redis locally |
| `bun run db:migrate` | Apply database migrations |

> **Local dev policy**: Always use `bun run dev` (runs from `src/`) during development — never invoke `apps/api/dist/` directly in a dev environment. The `dist/` tree is built exclusively for Docker production images and may be stale. If you see `dist/` imports during debugging, delete `apps/api/dist/` and rebuild with `bun run build:api`.

> **`openapi-spec.json` policy**: The `openapi-spec.json` file in the repo root is a static snapshot of the merged API spec (Elysia + Better-Auth). It is a generated artefact — do not edit it manually. To regenerate it, start the API locally (`bun run dev:api`) and fetch `http://localhost:3001/api/internal/docs/merged.json`, then write the output to `openapi-spec.json`. The live, always-current spec is served at `/api/docs` (Swagger UI) and `/api/internal/docs/merged.json` (JSON) at runtime.

## Key Design Decisions

### Redirect Hot Path

`/r/[code]` resolves inside `apps/web` via `packages/redirect-domain` — no HTTP round-trip to `apps/api`. The flow:

1. Check Redis (`link:{code}`, TTL 1h) — serve immediately on hit
2. On miss: acquire distributed lock (SETNX, TTL 5s), query PostgreSQL, populate cache
3. Validate: `isActive`, `!isBanned`, `!expired`, `clicks < maxClicks`, destination URL is not a self-shortener loop
4. Fire-and-forget analytics via Redis Streams
5. Return 301/302 with `X-Request-Id`

### Caching

| Key pattern | TTL | Purpose |
|---|---|---|
| `link:{code}` | 1h | Redirect data |
| `link:meta:{code}` | 5m | OG metadata |
| `link:404:{code}` | 5m | Negative cache |
| `link:banned:{code}` | 24h | Banned links |
| `qr:{code}:{size}:{fmt}` | 24h | QR codes |
| `rl:{key}` | sliding | Rate limiting |
| `lock:{code}` | 5s | Stampede lock |

Invalidation is synchronous on link update/ban/delete; stampede protection uses SETNX with 50ms backoff for waiters.

### Rate Limiting

Sliding window via Redis Sorted Sets. Three non-overlapping layers:
- **API edge (`/api/*`):** global limit applied in `apps/api` `onBeforeHandle`
- **Redirect (`/r/:code`):** per-IP + per-link limit, dedicated handler
- **Link abuse guard:** per `shortCode`, redirect flow only

No double-charging within a single request path.

### Security

- **IP derivation:** canonical helpers in `@urlfy/telemetry` (`getClientIp`, `getClientIpFromHeaders`); direct proxy-header parsing in app code is forbidden and CI-enforced.
- **URL validation:** format, protocol (`http`/`https` only), domain blacklist, shortener block.
- **Redirect loop guard:** destination URL is checked server-side for self-shortener patterns → HTTP 421.
- **IP anonymization:** SHA-256 hash stored; raw IP never persisted.
- **Runtime secret guards:** `BETTER_AUTH_SECRET` and other critical env vars reject placeholder values at boot.

### Observability

`@elysiajs/opentelemetry` registered as the first Elysia plugin; spans are named after handler functions (`createLink`, `listUserLinks`, etc.). OTLP HTTP exports to Grafana LGTM. All app services initialize the SDK via `@urlfy/telemetry` before the first request.

### Authentication & Authorization

Better-Auth with `twoFactor` and `apiKey` plugins. Three auth methods:

| Method | Credential | Use case |
|---|---|---|
| Session | Cookie `session` | Browser / frontend |
| Bearer | `Authorization: Bearer <token>` | External API calls |
| API Key | `x-api-key: urlfy_sk_...` | Programmatic access |

Admin authority is derived from `ADMIN_GITHUB_ACCOUNT_ID` (linked GitHub account), not from a mutable `role` field.

#### Social OAuth Setup

`NEXT_PUBLIC_APP_URL` is the single source of truth for the public OAuth origin. Both Google and GitHub callback URLs are derived from it at startup — no separate callback env var is needed.

In containerized deployments, keep `NEXT_PUBLIC_APP_URL` aligned across the web build arg, the web runtime env, and `BETTER_AUTH_URL` so the rendered site origin and the emitted OAuth callback origin never drift. When the web and API containers sit behind nginx or Traefik, set `TRUST_PROXY=true` on both services so shared auth and telemetry code trust the forwarded host, scheme, and client IP.

**Google Cloud Console** — register both authorised redirect URIs:

```
http://localhost:3000/api/auth/callback/google   ← local dev
https://urlfy.cc/api/auth/callback/google        ← production
```

**GitHub OAuth App** — register the authorization callback URL:

```
https://urlfy.cc/api/auth/callback/github        ← production
```

For local GitHub OAuth, create a **separate** dedicated app pointing to `http://localhost:3000/api/auth/callback/github` instead of sharing the production app. GitHub OAuth Apps use a single registered callback URL, so a separate local app avoids swapping the production callback every time you change environments.

Providers are enabled only when **both** `CLIENT_ID` and `CLIENT_SECRET` are set. See `.env.example` for the exact variable names and full registration guidance.

## Database

| Table | Description |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better-Auth core |
| `twoFactors`, `apikeys` | Better-Auth plugins |
| `links` | Short links — `short_code` (unique), `original_url`, `redirect_type` (301/302), `clicks_count`, `max_clicks`, `password_hash`, `expires_at`, OG meta fields, UTM fields, soft delete (`deleted_at`) |
| `analytics_events` | Partitioned by month — `visitor_hash`, `country`, `city`, `browser`, `os`, `device_type`, `referrer`, UTM fields, `is_bot` |
| `link_clicks_daily` | Pre-aggregated daily analytics |
| `deleted_links_audit` | Audit trail for deleted links |

Key indexes: `short_code` (unique), `user_id + deleted_at` (partial, listings), `expires_at` (partial, cleanup job), GIN `pg_trgm` on `short_code` + `original_url` (admin fuzzy search), GIN on `tags`.

## API Response Format

```jsonc
// Success
{ "success": true, "data": { ... } }

// Paginated
{ "success": true, "data": [...], "meta": { "total": 1000, "page": 1, "perPage": 20, "lastPage": 50, "hasMore": true } }

// Error
{ "success": false, "error": { "code": "LINK_NOT_FOUND", "message": "..." }, "requestId": "req_abc123" }
```

| Error code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing / invalid token |
| `PASSWORD_REQUIRED` | 401 | Password-protected link |
| `FORBIDDEN` | 403 | Insufficient permission |
| `LINK_NOT_FOUND` | 404 | Unknown short code |
| `LINK_EXPIRED` | 410 | Link past expiry |
| `REDIRECT_LOOP` | 421 | Self-shortener redirect loop detected |
| `URL_MALICIOUS` | 422 | Blocked URL |
| `RATE_LIMITED` | 429 | Too many requests |
| `LINK_BANNED` | 451 | Admin-banned link |
| `QUOTA_EXCEEDED` | 402 | Plan link quota reached |

Full interactive reference: `/api/docs` (Swagger) and `/api/auth/reference` (Better-Auth OpenAPI).

## Disaster Recovery

- **RTO / RPO:** < 1 hour
- PostgreSQL backup schedule: hourly (7-day retention), daily full at 02:00 UTC (30-day retention)
- Redis is ephemeral — cache rebuilds automatically on cold start

## Notes

- Runtime and configuration files are the source of truth for what exists today.
- The PRD (`.github/instructions/prd.instructions.md`) describes roadmap and future requirements, not guaranteed current implementation.
- This repository is available under the MIT License. See `LICENSE`.
