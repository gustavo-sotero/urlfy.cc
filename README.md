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
| **Queue**         | Redis Streams (BullMQ)   | Async analytics ingestion, background jobs      |
| **Auth**          | Better-Auth              | OAuth, 2FA, API keys, admin roles               |
| **Observability** | SigNoz (OpenTelemetry)   | Distributed traces, metrics, structured logs    |
| **GeoIP**         | MaxMind GeoLite2         | Credential-free auto-download (jsDelivr CDN)    |
| **UI**            | TailwindCSS + shadcn/ui  | Accessible component library, responsive design |
| **Validation**    | TypeBox + Zod            | Runtime schema validation, type inference       |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       DOCKER COMPOSE                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              APP (Next.js + ElysiaJS)                  │  │
│  │                                                        │  │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │   │   Proxy    │  │  Next.js   │  │    Elysia      │  │  │
│  │   │ (proxy.ts) │  │  (Pages)   │  │    (API)       │  │  │
│  │   └─────┬──────┘  └────────────┘  └───────┬────────┘  │  │
│  │         └──────────────────────────────────┘           │  │
│  └─────────────────────────┬──────────────────────────────┘  │
│                            │                                 │
│  ┌──────────┐  ┌───────────▼──────┐  ┌────────────────────┐ │
│  │PostgreSQL│  │      Redis       │  │      SigNoz        │ │
│  │    16    │  │        7         │  │  (Observability)   │ │
│  └──────────┘  └───────────▲──────┘  └────────────────────┘ │
│                            │                                 │
│  ┌─────────────────────────┼──────────────────────────────┐  │
│  │                   WORKERS PROCESS                      │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌────────────────┐  │  │
│  │  │ Analytics  │  │ Aggregation │  │    Cleanup     │  │  │
│  │  │  Worker    │  │   Worker    │  │    Worker      │  │  │
│  │  └────────────┘  └─────────────┘  └────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              GeoIP Downloader (auto)                   │  │
│  └────────────────────────────────────────────────────────┘  │
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

- [Bun](https://bun.sh) v1.x+
- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) 20+ (optional, for some tooling)

### 1. Clone the repository

```bash
git clone https://github.com/gustavo-sotero/urlfy.cc.git
cd urlfy.cc
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start infrastructure services

```bash
bun run docker:up
```

This starts **PostgreSQL 16** and **Redis 7** in Docker containers.

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables) below).

### 5. Run database migrations

```bash
bun run db:migrate
```

### 6. Seed initial data

```bash
bun run db:seed
```

### 7. Download GeoIP database (optional)

```bash
bun run docker:geoip
```

### 8. Start development server

```bash
bun run dev
```

The app will be available at **http://localhost:3000**.

> This starts both the Next.js app and the background workers concurrently.

## Environment Variables

| Variable                      | Required | Default                         | Description                              |
| ----------------------------- | -------- | ------------------------------- | ---------------------------------------- |
| `DATABASE_URL`                | Yes      | —                               | PostgreSQL connection string             |
| `BETTER_AUTH_SECRET`          | Yes      | —                               | Auth secret (min 32 chars)               |
| `INTERNAL_API_SECRET`         | Yes      | —                               | Internal API security key (min 16 chars) |
| `REDIS_URL`                   | No       | `redis://localhost:6379`        | Redis connection string                  |
| `NEXT_PUBLIC_APP_URL`         | No       | `http://localhost:3000`         | Public application URL                   |
| `JWT_SECRET`                  | Prod     | —                               | JWT secret for password-protected links  |
| `INTERNAL_ANALYTICS_SECRET`   | Prod     | —                               | Separate secret for analytics API        |
| `GOOGLE_CLIENT_ID`            | No       | —                               | Google OAuth client ID                   |
| `GOOGLE_CLIENT_SECRET`        | No       | —                               | Google OAuth client secret               |
| `GITHUB_CLIENT_ID`            | No       | —                               | GitHub OAuth client ID                   |
| `GITHUB_CLIENT_SECRET`        | No       | —                               | GitHub OAuth client secret               |
| `RESEND_API_KEY`              | No       | —                               | Resend API key for transactional emails  |
| `RESEND_FROM`                 | No       | —                               | Sender email address                     |
| `TELEGRAM_BOT_TOKEN`          | No       | —                               | Telegram bot token for contact alerts    |
| `TELEGRAM_CHAT_ID`            | No       | —                               | Telegram chat ID for notifications       |
| `TELEMETRY_ENABLED`           | No       | `false`                         | Enable OpenTelemetry tracing             |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No       | —                               | SigNoz/OTLP collector endpoint           |
| `GEOIP_DB_PATH`               | No       | `/app/geoip/GeoLite2-City.mmdb` | Path to GeoLite2 MMDB file               |
| `TRUSTED_ORIGINS`             | No       | —                               | Comma-separated list of trusted origins  |

## Scripts

### Development

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `bun run dev`        | Start app + workers in dev mode (hot reload)   |
| `bun run dev:app`    | Start only the Next.js app                     |
| `bun run worker:dev` | Start only the background workers (watch mode) |
| `bun run lint`       | Check & fix with Biome                         |
| `bun run format`     | Format code with Biome                         |
| `bun run type-check` | TypeScript type checking                       |

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

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `bun run build` | Build Next.js + post-build scripts |
| `bun run start` | Start production app + workers     |

### Testing

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `bun test`                 | Run all tests                  |
| `bun run test:unit`        | Run unit tests only            |
| `bun run test:integration` | Run integration tests          |
| `bun run test:security`    | Run security tests             |
| `bun run test:e2e`         | Run Playwright E2E tests       |
| `bun run test:coverage`    | Run tests with coverage report |

### Security

| Command                   | Description                   |
| ------------------------- | ----------------------------- |
| `bun run security:report` | Generate security report      |
| `bun run security:audit`  | Audit production dependencies |
| `bun run security:scan`   | Run Snyk security scan        |

## API

The ElysiaJS API is mounted at `/api/` via a Next.js catch-all route and auto-generates OpenAPI documentation.

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
| GET    | `/api/health/ready`        | Readiness check (DB + Redis)  | —        |

> Full API reference: [docs/api/endpoints.md](docs/api/endpoints.md)

## Project Structure

```
src/
├── app/                    # Next.js App Router (pages, layouts, API gateway)
│   ├── api/[[...slugs]]/   # ElysiaJS API catch-all mount point
│   └── [locale]/           # i18n routing
├── components/             # React components (UI, dashboard, admin, etc.)
├── db/
│   ├── schema/             # Drizzle ORM schemas (single source of truth)
│   └── scripts/            # Seed data, migration runners
├── emails/                 # React Email templates
├── i18n/                   # Internationalization config
├── lib/                    # Shared utilities, auth config, env validation
├── messages/               # Translation files (pt-BR, en)
├── server/
│   ├── modules/            # Feature-based API modules (Elysia MVC)
│   │   ├── links/          # Link CRUD, QR codes, UTM
│   │   ├── analytics/      # Click analytics, aggregation
│   │   ├── auth/           # Authentication endpoints
│   │   ├── admin/          # Admin panel API
│   │   └── ...
│   ├── middleware/          # Redirect engine, rate limiting, security headers
│   ├── services/           # Shared business logic
│   ├── workers/            # Background job processors
│   └── lib/                # Server utilities (cache, queue, circuit breaker)
├── proxy.ts                # Edge redirect proxy (hot path)
└── workers.ts              # Worker process entry point

docker/
├── docker-compose.yml      # Dev: PostgreSQL + Redis
├── docker-compose.prod.yml # Production compose
├── Dockerfile              # Multi-stage app build
└── geoip/                  # GeoIP auto-downloader

tests/
├── unit/                   # Unit tests
├── integration/            # Integration tests
├── security/               # Security tests
├── e2e/                    # Playwright E2E tests
├── load/                   # Load testing (k6)
└── perf/                   # Performance benchmarks
```

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run specific suites
bun run test:unit
bun run test:integration
bun run test:security
bun run test:e2e
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
# Build the app image
bun run docker:build:app

# Start with production compose
cd docker && docker compose -f docker-compose.prod.yml up -d
```

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
| [Observability](docs/architecture/observability-elysia.md) | OpenTelemetry + SigNoz setup           |
| [Best Practices](docs/development/best-practices.md)       | Code conventions and patterns          |

## License

This project is private and not licensed for public use.

---

<p align="center">
  Built with Bun, Next.js, ElysiaJS, and PostgreSQL.<br/>
  Made by <a href="https://github.com/gustavo-sotero">Gustavo Sotero</a>.
</p>
