# Ownership Matrix

## Services

| Area | Primary Owner | Secondary Owner | Notes |
| --- | --- | --- | --- |
| `apps/web` | Platform Frontend | Platform Backend | Next.js UI, proxy, redirect HTTP handler |
| `apps/api` | Platform Backend | Platform Frontend | Elysia API, auth mutations, admin/public endpoints |
| `apps/worker` | Data Platform | Platform Backend | Streams consumers, aggregation, cleanup jobs |

## Shared Packages

| Package | Primary Owner | Secondary Owner | Notes |
| --- | --- | --- | --- |
| `packages/contracts` | Platform Backend | Platform Frontend | Request/response contracts and shared DTOs |
| `packages/redirect-domain` | Platform Backend | Data Platform | Redirect business rules and cache-aside logic |
| `packages/data` | Data Platform | Platform Backend | Drizzle schema, migrations, DB access |
| `packages/cache` | Platform Backend | Data Platform | Redis client, locks, stream helpers |
| `packages/telemetry` | Platform SRE | Platform Backend | Logging, traces, metrics utilities |
| `packages/auth-shared` | Platform Backend | Platform Frontend | Shared auth scopes/roles helpers |
| `packages/config-ts` | Platform Frontend | Platform Backend | Shared TypeScript config presets |
| `packages/config-biome` | Platform Frontend | Platform Backend | Shared lint/format config |

## Operational Ownership

| Operational Concern | Primary Owner | Secondary Owner | Notes |
| --- | --- | --- | --- |
| CI/CD (`.github/workflows/ci.yml`) | Platform SRE | Platform Backend | Turbo tasks, test/build gates |
| Docker (`docker/*.Dockerfile`, compose) | Platform SRE | Platform Backend | Multi-service image build and runtime |
| Security headers/rate-limit | Platform Backend | Platform SRE | API edge and web operational middleware controls |
| Observability/SLO alerts | Platform SRE | Platform Backend | P99, error-rate, cache-miss alerts |
| Backup and DR procedures | Data Platform | Platform SRE | RPO/RTO process ownership |

## Escalation Rule

If an incident spans multiple areas, the owner of the failing runtime service leads mitigation, and secondary owners assist until service health is restored.
