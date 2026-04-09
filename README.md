<p align="center">
  <h1 align="center">urlfy.cc</h1>
  <p align="center">High-performance, self-hosted URL shortener with analytics, built for speed and privacy.</p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment</a> •
  <a href="#scripts">Scripts</a> •
  <a href="#api">API</a> •
  <a href="#testing">Testing</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#documentation">Docs</a>
</p>

---

## Features

- **Instant URL shortening** — no account required for basic usage
- **Custom aliases** — branded short links for logged-in users
- **Analytics dashboard** — clicks/day, geo-location, device & browser breakdown
- **Password-protected links** — optional password gate before redirect
- **Link expiration** — time-based and click-based expiration
- **QR Code generation** — PNG/SVG export with configurable sizes (100–1000px)
- **UTM tracking** — built-in `utm_source`, `utm_medium`, `utm_campaign` support
- **Custom OG meta tags** — control link previews (title, description, image)
- **Configurable redirect** — 301 (permanent) or 302 (temporary) per link
- **API key access** — programmatic link management for developers
- **Admin panel** — global KPIs, link moderation, user management, audit logs
- **LGPD/GDPR compliant** — IP anonymization (SHA-256), data export/deletion endpoints, consent banner
- **Dark mode** — full theme support

## Tech Stack

| Layer             | Technology               | Purpose                                         |
| ----------------- | ------------------------ | ----------------------------------------------- |
| **Runtime**       | Bun 1.x+                 | Native SQL, Redis, and password hashing APIs    |
| **Frontend**      | Next.js 16+ (App Router) | SSR, RSC, i18n routing via `next-intl`          |
| **API**           | ElysiaJS                 | Type-safe REST API with OpenAPI auto-generation |
| **Database**      | PostgreSQL 16            | Partitioned analytics, Drizzle ORM              |
| **Cache**         | Redis 7                  | Hot-path caching, rate limiting, queues         |
| **Queue**         | Redis Streams            | Async analytics ingestion, background jobs      |
| **Auth**          | Better-Auth              | OAuth, 2FA, API keys, admin roles               |
| **Observability** | Grafana LGTM + OTLP      | Distributed traces, metrics, structured logs    |
| **GeoIP**         | MaxMind GeoLite2         | Credential-free auto-download (jsDelivr CDN)    |
| **UI**            | TailwindCSS + shadcn/ui  | Accessible component library, responsive design |
| **Validation**    | TypeBox + Zod            | Runtime schema validation, type inference       |

## Architecture

### Monorepo Structure

This project is organized as a **Bun Workspaces + Turborepo** monorepo:

```
urlfy.cc/
├── apps/
│   ├── web/          # Next.js 16 frontend + redirect hot path
│   ├── api/          # Standalone ElysiaJS API server (port 3001)
│   └── worker/       # Redis Streams workers (analytics, cleanup)
├── packages/
│   ├── auth-shared/  # ACL scopes shared by api and web
│   ├── cache/        # Redis client, cache keys, distributed lock
│   ├── config-biome/ # Shared Biome formatter/linter config
│   ├── config-ts/    # Shared TypeScript configs (base/nextjs/server)
│   ├── contracts/    # API types (request/response shapes)
│   ├── data/         # Drizzle ORM schemas + DB client
│   ├── redirect-domain/ # Redirect domain logic (cache, validate, url-build)
│   └── telemetry/    # OpenTelemetry + structured logging (LogTape)
├── docker/
│   ├── docker-compose.yml         # Infrastructure (PostgreSQL, Redis, GeoIP)
│   └── docker-compose.apps.yml    # Application services overlay (web/api/worker)
└── packages/data/migrations/  # Database migrations (authoritative path)
```

### Service Communication

```
Browser → apps/web (port 3000 / Next.js)
            ├── /r/:code  → redirect hot path (in-process, no network hop)
            │               uses @urlfy/redirect-domain package
            └── /api/**   → HTTP proxy to apps/api (port 3001)

apps/api (port 3001 / ElysiaJS)
            └── writes analytics events → Redis Streams

apps/worker (no port / Bun)
            └── consumes Redis Streams → PostgreSQL
```

```

┌──────────────────────────────────────────────────────────────┐
│                       DOCKER COMPOSE                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    HTTP    ┌───────────────────────┐  │
│  │   apps/web       │───────────►│      apps/api         │  │
│  │  Next.js + proxy │ /api/*     │     Elysia service    │  │
│  │  /r/:code local  │            │     auth + REST       │  │
│  └────────┬─────────┘            └──────────┬────────────┘  │
│           │                                  │               │
│           │ Redis / DB hot path              │ Redis Streams │
│           ▼                                  ▼               │
│  ┌────────────────────┐              ┌────────────────────┐  │
│  │     PostgreSQL     │◄────────────►│       Redis        │  │
│  │        16          │              │         7          │  │
│  └────────────────────┘              └─────────┬──────────┘  │
│                                                │             │
│                                      consumes   ▼             │
│                              ┌──────────────────────────────┐ │
│                              │        apps/worker           │ │
│                              │ analytics + cleanup workers  │ │
│                              └──────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   GeoIP Downloader + local OTLP collector (optional)  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Redirect Hot Path

The redirect engine is optimized for sub-30ms P50 latency:

1. **Proxy** intercepts `/:code` requests
2. **Redis cache** lookup (cache-aside pattern with stampede protection)
3. **PostgreSQL** fallback on cache miss (with distributed lock via SETNX)
4. **Validation** — active, not banned, not expired, within click limit, redirect depth < 3
5. **Async analytics** — event enqueued to Redis Streams (non-blocking)
6. **Redirect** — 301 or 302 response with `X-Request-Id` header

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3.10+
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/gustavo-sotero/urlfy.cc.git
cd urlfy.cc
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start infrastructure

```bash
bun run docker:up
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The same env file is used by all services.

Key env for the monorepo:
- `API_INTERNAL_URL` — URL that apps/web proxies API calls to (default: `http://localhost:3001`)
- `API_PORT` — Port for the standalone Elysia API server (default: `3001`)

### 5. Run database migrations

```bash
bun run db:migrate
```

### 6. Seed initial data

```bash
bun run db:seed
```

### 7. Start development servers

```bash
bun run dev
```

This uses **Turborepo** to start all apps in parallel:
- `apps/web` → [http://localhost:3000](http://localhost:3000) (Next.js)
- `apps/api` → [http://localhost:3001](http://localhost:3001) (Elysia API)
- `apps/worker` → background process (no HTTP)

> **Or start individual services:**
> ```bash
> bun run dev:web     # Next.js only
> bun run dev:api     # Elysia API only
> bun run dev:worker  # Worker only
> ```

### Running with Docker Compose (all services)

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.apps.yml up -d
```


## Environment Variables

| Variable                      | Required | Default                         | Description                              |
| ----------------------------- | -------- | ------------------------------- | ---------------------------------------- |
| `DATABASE_URL`                | Yes      | —                               | PostgreSQL connection string (used by both `api` and `web`) |
| `BETTER_AUTH_SECRET`          | Yes      | —                               | Auth secret (min 32 chars)               |
| `INTERNAL_API_SECRET`         | Yes      | —                               | Internal API security key injected into `api`, `web` and `worker` (min 16 chars) |
| `REDIS_URL`                   | No       | `redis://localhost:6379`        | Redis connection string                  |
| `NEXT_PUBLIC_APP_URL`         | No       | `http://localhost:3000`         | Public application URL                   |
| `JWT_SECRET`                  | Prod     | —                               | JWT secret for password-protected links  |
| `INTERNAL_ANALYTICS_SECRET`   | Prod     | —                               | Separate analytics secret required by `api` and `worker` in production |
| `GOOGLE_CLIENT_ID`            | No       | —                               | Google OAuth client ID                   |
| `GOOGLE_CLIENT_SECRET`        | No       | —                               | Google OAuth client secret               |
| `GITHUB_CLIENT_ID`            | No       | —                               | GitHub OAuth client ID                   |
| `GITHUB_CLIENT_SECRET`        | No       | —                               | GitHub OAuth client secret               |
| `RESEND_API_KEY`              | No       | —                               | Resend API key for transactional emails  |
| `RESEND_FROM`                 | No       | —                               | Sender email address                     |
| `TELEGRAM_BOT_TOKEN`          | No       | —                               | Telegram bot token for contact alerts    |
| `TELEGRAM_CHAT_ID`            | No       | —                               | Telegram chat ID for notifications       |
| `TELEMETRY_ENABLED`           | No       | `false`                         | Enable OpenTelemetry traces, metrics, and logs |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No       | —                               | OTLP HTTP collector base endpoint (no `/v1/*` suffix) |
| `GEOIP_DB_PATH`               | No       | `/app/geoip/GeoLite2-City.mmdb` | Path to GeoLite2 MMDB file               |
| `TRUSTED_ORIGINS`             | No       | —                               | Comma-separated list of trusted origins  |
| `API_INTERNAL_URL`            | No       | `http://localhost:3001`         | URL apps/web proxies API calls to        |
| `API_PORT`                    | No       | `3001`                          | Port for the standalone Elysia API server |

## Scripts

### Development

| Command               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `bun run dev`         | Start all apps in parallel (Turborepo)                   |
| `bun run dev:web`     | Start only apps/web (Next.js, port 3000)                 |
| `bun run dev:api`     | Start only apps/api (Elysia, port 3001)                  |
| `bun run dev:worker`  | Start only apps/worker (background workers)              |
| `bun run lint`        | Lint & auto-fix all workspaces (Biome)                   |
| `bun run format`      | Format all workspaces (Biome)                            |
| `bun run type-check`  | Type-check all workspaces (Turborepo → tsc --noEmit)     |

### Database

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `bun run db:generate` | Generate Drizzle migrations              |
| `bun run db:migrate`  | Run pending migrations                   |
| `bun run db:push`     | Push schema directly (prototyping only)  |
| `bun run db:studio`   | Open Drizzle Studio (visual DB explorer) |
| `bun run db:seed`     | Seed reserved slugs                      |

### Docker

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `bun run docker:up`    | Start PostgreSQL + Redis containers |
| `bun run docker:down`  | Stop all containers                 |
| `bun run docker:logs`  | Tail container logs                 |
| `bun run docker:geoip` | Download GeoLite2 database          |

### Build & Production

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `bun run build`      | Build all apps and shared packages              |
| `bun run build:web`  | Build only apps/web                             |
| `bun run build:api`  | Build only apps/api                             |
| `bun run build:worker` | Build only apps/worker                        |
| `bun run start`      | Start all apps in production mode               |
| `bun run start:web`  | Start apps/web production server                |
| `bun run start:api`  | Start apps/api production server                |
| `bun run start:worker` | Start apps/worker production process          |

### Testing

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `bun run test`             | Run workspace test suites      |
| `bun run test:unit`        | Run unit tests only            |
| `bun run test:integration` | Run integration tests          |
| `bun run test:security`    | Run security tests             |
| `bun run test:perf`        | Run Bun perf suites            |
| `bun run test:load`        | Run k6 redirect load harness   |
| `bun run test:e2e`         | Run Playwright E2E tests       |

### Security

| Command                   | Description                   |
| ------------------------- | ----------------------------- |
| `bun run security:report` | Generate security report      |
| `bun run security:audit`  | Audit production dependencies |
| `bun run security:scan`   | Run Snyk security scan        |

## API

The ElysiaJS API runs as a standalone Bun service in `apps/api`. The web app proxies `/api/*` traffic to that service and preserves request correlation headers and response envelopes.

### Key Endpoints

| Method | Endpoint                   | Description                   | Auth     |
| ------ | -------------------------- | ----------------------------- | -------- |
| POST   | `/api/links`               | Create short link             | Optional |
| GET    | `/api/links`               | List user's links (paginated) | Required |
| GET    | `/api/links/:id`           | Get link details              | Required |
| PATCH  | `/api/links/:id`           | Update link                   | Required |
| DELETE | `/api/links/:id`           | Soft-delete link              | Required |
| GET    | `/api/links/:id/analytics` | Get link analytics            | Required |
| GET    | `/api/links/:id/qrcode`    | Generate QR code              | Optional |
| POST   | `/api/auth/sign-up`        | Register new user             | —        |
| POST   | `/api/auth/sign-in`        | Sign in                       | —        |
| GET    | `/api/auth/reference`      | Auth API documentation        | —        |
| GET    | `/api/me/export`           | LGPD data export              | Required |
| DELETE | `/api/me/data`             | LGPD data deletion request    | Required |
| GET    | `/api/health`              | Health check                  | —        |
| GET    | `/api/health/ready`        | Readiness check (DB required, Redis degraded allowed) | —        |

> Full API reference: [docs/api/endpoints.md](docs/api/endpoints.md)

## Project Structure

```
urlfy.cc/
├── apps/
│   ├── web/                      # Next.js 16 (frontend + redirect hot path)
│   │   └── src/
│   │       ├── app/              # App Router (pages, layouts, API proxy)
│   │       │   ├── api/[[...slugs]]/  # Proxy: forwards /api/* → apps/api
│   │       │   └── r/[code]/     # Redirect hot path (in-process)
│   │       ├── components/       # React components (UI, dashboard, admin)
│   │       ├── lib/              # Client utilities, auth client, env
│   │       └── server/           # Server-only utilities (email, audit)
│   │   └── tests/                # Web integration, perf, and security tests
│   ├── api/                      # ElysiaJS standalone API (port 3001)
│   │   └── src/server/
│   │       ├── modules/          # Feature-based Elysia MVC
│   │       │   ├── links/        # Link CRUD, QR codes, UTM
│   │       │   ├── analytics/    # Click analytics, aggregation
│   │       │   ├── auth/         # Authentication endpoints
│   │       │   └── admin/        # Admin panel API
│   │       ├── middleware/       # Rate limiting, security, auth
│   │       ├── services/         # Shared business logic
│   │       └── lib/              # Server utilities (cache, queue, circuit breaker)
│   │   └── tests/                # API integration, perf, and security tests
│   └── worker/                   # Redis Streams workers (Bun process)
│       └── src/
│           ├── workers/          # Analytics, aggregation, cleanup, deletion
│           └── jobs/             # Scheduled jobs
│       └── tests/                # Worker unit tests
├── packages/
│   ├── auth-shared/              # ACL scopes + Better-Auth config shared by api and web
│   ├── cache/                    # Redis client, cache keys, distributed lock
│   ├── config-biome/             # Shared Biome formatter/linter config
│   ├── config-ts/                # Shared TypeScript configs (base/nextjs/server)
│   ├── contracts/                # API types (request/response shapes)
│   ├── data/                     # Drizzle ORM schemas + DB client
│   ├── redirect-domain/          # Redirect logic (cache, validate, url-build)
│   └── telemetry/                # OpenTelemetry + structured logging
├── load/
│   └── k6/                       # Redirect load harness and instructions
├── docker/
│   ├── docker-compose.yml        # Infrastructure (PostgreSQL, Redis, GeoIP)
│   ├── docker-compose.apps.yml   # Application services overlay
│   ├── web.Dockerfile            # apps/web multi-stage image
│   ├── api.Dockerfile            # apps/api multi-stage image
│   ├── worker.Dockerfile         # apps/worker multi-stage image
│   └── geoip/                    # GeoLite2 auto-downloader
└── packages/data/migrations/     # Database migrations
```

## Testing

```bash
# Run workspace suites
bun run test
bun run test:unit
bun run test:integration
bun run test:security
bun run test:perf
bun run test:e2e

# Run the manual redirect load harness
BASE_URL=http://localhost:3000 SHORT_CODE=mycode bun run test:load
```

### Performance Targets

| Metric               | Target  |
| -------------------- | ------- |
| Redirect Latency P50 | < 30ms  |
| Redirect Latency P99 | < 300ms |
| API Latency P99      | < 300ms |
| Availability         | 99.9%   |
| Cache Hit Rate       | > 85%   |
| Error Rate           | < 0.1%  |

## Deployment

### Docker (Production)

```bash
# Build individual app images
docker build -f docker/web.Dockerfile -t urlfy-web .
docker build -f docker/api.Dockerfile -t urlfy-api .

# Start all services (infra + apps)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.apps.yml up -d

# Or use the production compose
cd docker && docker compose -f docker-compose.prod.yml up -d
```

The web image validates runtime env on startup, and the worker validates its own runtime secret set before consuming Redis Streams. CI smoke-tests that required services fail fast without mandatory secrets and serve `/api/health` when booted with valid runtime env. Docker and Compose health checks use `/api/health/ready` to verify traffic readiness: database and upstream API remain mandatory, while Redis degradation is surfaced without blocking startup.

### Backup & Recovery

| Metric | Target   |
| ------ | -------- |
| RTO    | < 1 hour |
| RPO    | < 1 hour |

- **PostgreSQL**: `pg_dump` via cron or pgBackRest for PITR
- **Redis**: Cache-only (RDB snapshots optional)
- **Backup script**: `scripts/backup.sh`

## Documentation

| Document                                                   | Description                            |
| ---------------------------------------------------------- | -------------------------------------- |
| [Architecture Overview](docs/architecture/overview.md)     | System architecture and Docker Compose |
| [Database Schema](docs/architecture/database-schema.md)    | Tables, indexes, partitioning strategy |
| [Caching Strategy](docs/architecture/caching-strategy.md)  | Redis cache-aside, stampede protection |
| [Security](docs/architecture/security.md)                  | Rate limiting, CORS, CSRF, LGPD        |
| [API Endpoints](docs/api/endpoints.md)                     | Full REST API reference                |
| [Observability](docs/architecture/observability-elysia.md) | OpenTelemetry + LGTM / OTLP collector setup |
| [Best Practices](docs/development/best-practices.md)       | Code conventions and patterns          |
| [Decoupling Status](docs/architecture/monorepo-decoupling.md) | Monorepo split implementation status |
| [Redirect Performance Baseline](docs/development/redirect-performance-baseline.md) | Baseline and k6 validation flow |

## License

This project is private and not licensed for public use.

---

<p align="center">
  Built with Bun, Next.js, ElysiaJS, and PostgreSQL.<br/>
  Made by <a href="https://github.com/gustavo-sotero">Gustavo Sotero</a>.
</p>
