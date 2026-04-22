# urlfy.cc

Self-hosted URL shortener built as a real product project. This repository also serves as portfolio material, applied research, and an ongoing study in Bun, React 19, Next.js 16, Elysia, and operational trade-offs.

## What Exists Today

- Next.js 16 + React 19 web app with localized public pages, auth flows, dashboard, and redirect hot path
- Dedicated Elysia API under `/api/*`, with interactive docs at `/api/docs`
- Bun worker for analytics, cleanup, and other asynchronous jobs
- Shared packages for contracts, cache, data, auth, telemetry, and redirect-domain logic
- Docker-based local and production topologies with same-origin browser access in dev and ingress-based routing in production

## Stage And Scope

- Current codebase: a working product surface with concrete runtime and operational decisions documented in-repo
- Applied-research / proof-of-concept areas: some runtime, caching, observability, and deployment choices are exercised here as part of the learning and validation process
- Roadmap and future requirements: [docs/prd.md](docs/prd.md)

## Topology

```text
Browser
  -> same-origin web entrypoint (:3000 locally)
     -> /api/*   -> apps/api (Elysia, :3001)
     -> /r/:code -> apps/web redirect hot path
     -> pages/*  -> apps/web (Next.js 16)

Background work
  -> apps/worker (Bun worker)
```

In local development, `next.config.ts` rewrites keep browser calls same-origin. In production, ingress routes `/api/*` to the dedicated API service while the web app keeps the public shell and redirect entrypoints.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) `1.3.11+`
- [Docker](https://www.docker.com/) with Compose

```bash
git clone https://github.com/gustavo-sotero/urlfy.cc.git
cd urlfy.cc
bun install
bun run docker:up
```

Copy `.env.example` to `.env`, then set at least:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `INTERNAL_API_SECRET`
- `ADMIN_GITHUB_ACCOUNT_ID`

```bash
bun run db:migrate
bun run db:seed
bun run dev
```

Local services:

- Web app: `http://localhost:3000`
- Same-origin API docs: `http://localhost:3000/api/docs`
- Direct API service: `http://localhost:3001/api/docs`
- Health checks: `http://localhost:3001/api/health` and `http://localhost:3001/api/health/ready`

## Useful Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start web, api, and worker via Turborepo |
| `bun run dev:web` | Start only the Next.js app |
| `bun run dev:api` | Start only the Elysia API |
| `bun run dev:worker` | Start only the Bun worker |
| `bun run lint` | Run the Biome lint pipeline |
| `bun run type-check` | Type-check all workspaces |
| `bun run test` | Run the workspace test suites |
| `bun run test:unit` | Run unit tests |
| `bun run test:integration` | Run integration tests |
| `bun run test:e2e` | Run Playwright end-to-end tests |
| `bun run test:load` | Run redirect load validation (`k6`) |
| `bun run docker:up` | Start PostgreSQL and Redis locally |
| `bun run db:migrate` | Apply database migrations |

## Documentation

The README is intentionally short. Use the docs according to depth:

- [docs/architecture/overview.md](docs/architecture/overview.md): overall system shape, service topology, Docker, and deployment notes
- [docs/architecture/monorepo-decoupling.md](docs/architecture/monorepo-decoupling.md): current split between web, api, worker, and shared packages
- [docs/architecture/database-schema.md](docs/architecture/database-schema.md): schema, indexes, and partitioning
- [docs/architecture/caching-strategy.md](docs/architecture/caching-strategy.md): redirect cache, locks, and invalidation strategy
- [docs/architecture/security.md](docs/architecture/security.md): rate limiting, headers, privacy, and security posture
- [docs/architecture/observability-elysia.md](docs/architecture/observability-elysia.md): telemetry and OTLP/LGTM setup
- [docs/api/endpoints.md](docs/api/endpoints.md): full API reference
- [docs/development/redirect-performance-baseline.md](docs/development/redirect-performance-baseline.md): redirect validation workflow and targets
- [docs/prd.md](docs/prd.md): roadmap and future scope

## Notes

- Runtime and configuration files are the source of truth for what exists today.
- This README is the short repo entry point; architecture and API docs are the deeper references.
- The PRD describes roadmap and future requirements, not guaranteed current implementation.
- This repository is private and not licensed for public use.
