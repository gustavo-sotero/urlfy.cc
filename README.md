<p align="center">
  <h1 align="center">urlfy.cc</h1>
  <p align="center">Production-grade, self-hosted URL shortener with analytics — also a portfolio and applied-research project.</p>
</p>

<p align="center">
  <a href="#what-it-is">What it is</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#scripts">Scripts</a> •
  <a href="#documentation">Docs</a>
</p>

---

## What it is

**urlfy.cc** is a production-grade URL shortener — also a portfolio and applied-research project. It runs in production with real users, containerized infrastructure, and active development.

**Implemented today:**
- Instant URL shortening (no account required)
- Custom aliases, password-protected links, link expiration
- Analytics dashboard (clicks/day, geo-location, device breakdown)
- QR Code generation, UTM tracking, custom OG meta tags
- Configurable redirect (301/302), API key access
- Admin panel (KPIs, link moderation, user management, audit logs)
- LGPD/GDPR compliance (IP anonymization, data export/deletion, consent)

**Experimental / roadmap:**
- Advanced analytics (funnels, cohorts) — spec only
- Workspaces/Teams, custom domains, A/B testing — backlog

> Full roadmap: [docs/prd.md](docs/prd.md)

## Tech Stack

| Layer             | Technology               | Purpose                                         |
| ----------------- | ------------------------ | ----------------------------------------------- |
| **Runtime**       | Bun 1.x+                 | Native SQL, Redis, and password hashing APIs    |
| **Frontend**      | Next.js 16+ (App Router) | SSR, RSC, i18n routing via `next-intl`          |
| **API**           | ElysiaJS                 | Type-safe REST API with OpenAPI auto-generation |
| **Database**      | PostgreSQL 16            | Partitioned analytics, Drizzle ORM              |
| **Cache**         | Redis 7                  | Hot-path caching, rate limiting, queues         |
| **Queue**         | Redis Streams            | Async analytics ingestion, background jobs      |
| **Auth**          | Better-Auth              | OAuth, 2FA, API keys, GitHub-based admin        |
| **Observability** | Grafana LGTM + OTLP      | Distributed traces, metrics, structured logs    |
| **GeoIP**         | MaxMind GeoLite2         | Credential-free auto-download (jsDelivr CDN)    |
| **UI**            | TailwindCSS + shadcn/ui  | Accessible component library, responsive design |
| **Validation**    | TypeBox + Zod            | Runtime schema validation, type inference       |

## Architecture

Bun Workspaces + Turborepo monorepo — three services behind a same-origin edge:

```
Browser → same-origin edge (:3000 locally / main domain in prod)
  ├── /api/**  → apps/api (ElysiaJS, port 3001)
  ├── /r/:code → apps/web redirect hot path (in-process, no network hop)
  └── pages/** → apps/web (Next.js 16)
```

> Detailed diagrams, service communication, and redirect hot-path walkthrough: [docs/architecture/overview.md](docs/architecture/overview.md)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.10+
- [Docker](https://www.docker.com/) & Docker Compose

```bash
# 1. Clone and install
git clone https://github.com/gustavo-sotero/urlfy.cc.git
cd urlfy.cc
bun install

# 2. Start infrastructure
bun run docker:up

# 3. Configure environment
cp .env.example .env
# Edit .env — key vars: DATABASE_URL, BETTER_AUTH_SECRET, INTERNAL_API_SECRET, ADMIN_GITHUB_ACCOUNT_ID

# 4. Migrate and seed
bun run db:migrate
bun run db:seed

# 5. Start development servers
bun run dev
```

This starts all apps via **Turborepo**:
- `apps/web` → http://localhost:3000 (Next.js)
- `apps/api` → http://localhost:3001 (Elysia API)
- `apps/worker` → background process (no HTTP)

> **Individual services:** `bun run dev:web` · `bun run dev:api` · `bun run dev:worker`
>
> **Docker Compose (all services):** `docker compose -f docker/docker-compose.yml -f docker/docker-compose.apps.yml up -d`

### Key Environment Variables

| Variable                      | Required | Description                              |
| ----------------------------- | -------- | ---------------------------------------- |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string             |
| `BETTER_AUTH_SECRET`          | Yes      | Auth secret (min 32 chars)               |
| `INTERNAL_API_SECRET`         | Yes      | Internal API security key (min 16 chars) |
| `ADMIN_GITHUB_ACCOUNT_ID`     | Yes      | GitHub accountId of the authorized admin |

> Full env reference: [docs/architecture/overview.md](docs/architecture/overview.md)

## Scripts

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `bun run dev`              | Start all apps (Turborepo)     |
| `bun run dev:web`          | Next.js only                   |
| `bun run dev:api`          | Elysia API only                |
| `bun run dev:worker`       | Worker only                    |
| `bun run lint`             | Lint & auto-fix (Biome)        |
| `bun run type-check`       | Type-check all workspaces      |
| `bun run build`            | Build all apps and packages    |
| `bun run db:migrate`       | Run pending migrations         |
| `bun run db:seed`          | Seed reserved slugs            |
| `bun run docker:up`        | Start PostgreSQL + Redis       |
| `bun run test`             | Run workspace test suites      |
| `bun run test:unit`        | Unit tests only                |
| `bun run test:integration` | Integration tests              |
| `bun run test:e2e`         | Playwright E2E tests           |
| `bun run test:load`        | k6 redirect load harness       |
| `bun run security:audit`   | Audit production dependencies  |

## API

Standalone ElysiaJS service at `apps/api`. In production, Traefik routes `/api/*` directly; in local dev, Next.js rewrites preserve same-origin semantics.

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
| GET    | `/api/health/ready`        | Readiness check               | —        |

> Full API reference: [docs/api/endpoints.md](docs/api/endpoints.md) · Interactive docs: `/api/docs`

## Performance Targets

| Metric               | Target  |
| -------------------- | ------- |
| Redirect Latency P50 | < 30ms  |
| Availability         | 99.9%   |

> Full SLO table, baseline measurements, and k6 validation: [docs/development/redirect-performance-baseline.md](docs/development/redirect-performance-baseline.md)

## Documentation

| Document                                                   | Description                            |
| ---------------------------------------------------------- | -------------------------------------- |
| [Architecture Overview](docs/architecture/overview.md)     | System architecture and Docker Compose |
| [Database Schema](docs/architecture/database-schema.md)    | Tables, indexes, partitioning strategy |
| [Caching Strategy](docs/architecture/caching-strategy.md)  | Redis cache-aside, stampede protection |
| [Security](docs/architecture/security.md)                  | Rate limiting, CORS, CSRF, LGPD        |
| [API Endpoints](docs/api/endpoints.md)                     | Full REST API reference                |
| [Observability](docs/architecture/observability-elysia.md) | OpenTelemetry + LGTM / OTLP setup      |
| [Best Practices](docs/development/best-practices.md)       | Code conventions and patterns          |
| [Decoupling Status](docs/architecture/monorepo-decoupling.md) | Monorepo split implementation status |
| [Redirect Performance](docs/development/redirect-performance-baseline.md) | Baseline and k6 validation |
| [PRD](docs/prd.md)                                         | Product requirements and roadmap       |

## License

This project is private and not licensed for public use.

---

<p align="center">
  Built with Bun, Next.js, ElysiaJS, and PostgreSQL.<br/>
  Made by <a href="https://github.com/gustavo-sotero">Gustavo Sotero</a>.
</p>
