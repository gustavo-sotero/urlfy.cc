# Dokploy Production Topology

> Reference for provisioning and configuring Dokploy Applications that back the `deploy.yml` CI/CD pipeline.
>
> **Keep this document in sync with env-schema changes in `apps/*/src/lib/env.ts`.**

---

## 1. Overview

Each service runs as an independent **Dokploy Application** sourced from GHCR. Production deploys use `POST /api/application.update` to pin each Application to the immutable `release-*` image recorded in `release-manifest.json`, then call `POST /api/application.deploy` to roll out that exact image. The staging workflow uses the same API-driven image pinning and can optionally repoint an Application back to `:stable` when you want channel-based validation instead of a release-specific image.

```
GHCR (immutable release-* tags + optional :stable channel)
        │
        ├── urlfy-api       (port 3001, traffic-serving)
        ├── urlfy-web       (port 3000, traffic-serving)
        ├── urlfy-worker    (background, no external port)
        ├── urlfy-migrate   (one-shot job, restart: never)
        └── urlfy-geoip     (cron updater, writes geoip_data volume)
```

External dependencies (managed outside Dokploy):

| Dependency  | Notes                                              |
|-------------|----------------------------------------------------|
| PostgreSQL   | Managed database (e.g. Neon, Supabase, RDS)        |
| Redis        | Managed cache/stream broker (e.g. Upstash)         |
| GeoLite2     | MMDB auto-downloaded from jsDelivr CDN (no MaxMind credentials required) |

---

## 2. Swarm Configuration

Apply these settings in **Dokploy → Application → Advanced → Docker Swarm Configuration** for each Application that serves traffic.  The JSON maps directly to the Swarm service spec overlay.

### 2.1 `urlfy-api` — zero-downtime

**Replicas:** Set to **2 or more** in Dokploy → Application → General → Replicas. A single replica cannot provide in-place replacement safety; zero-downtime rollout is only effective with at least 2 replicas running simultaneously.

```json
{
  "HealthCheck": {
    "Test": ["CMD", "curl", "-fsS", "http://127.0.0.1:3001/api/health/ready"],
    "Interval": 30000000000,
    "Timeout":  10000000000,
    "StartPeriod": 20000000000,
    "Retries": 3
  },
  "UpdateConfig": {
    "Parallelism": 1,
    "Delay":       10000000000,
    "FailureAction": "rollback",
    "Order": "start-first"
  },
  "RollbackConfig": {
    "Parallelism": 1,
    "Delay": 0,
    "FailureAction": "pause",
    "Order": "start-first"
  }
}
```

> `start-first`: new container is started and health-checked **before** the old one is stopped — guarantees zero downtime.  
> `FailureAction: rollback`: if the new replica fails health checks within the update window, Swarm automatically reverts.

### 2.2 `urlfy-web` — zero-downtime

**Replicas:** Set to **2 or more** in Dokploy → Application → General → Replicas. Same requirement as API — a single replica cannot sustain zero-downtime rollouts. Do not enable `DOKPLOY_DEPLOY_ENABLED` for Web until replica count is ≥ 2.

```json
{
  "HealthCheck": {
    "Test": ["CMD", "curl", "-fsS", "http://localhost:3000/ops/health/ready"],
    "Interval": 30000000000,
    "Timeout":  10000000000,
    "StartPeriod": 15000000000,
    "Retries": 3
  },
  "UpdateConfig": {
    "Parallelism": 1,
    "Delay":       10000000000,
    "FailureAction": "rollback",
    "Order": "start-first"
  },
  "RollbackConfig": {
    "Parallelism": 1,
    "Delay": 0,
    "FailureAction": "pause",
    "Order": "start-first"
  }
}
```

### 2.3 `urlfy-worker` — stop-first (no traffic)

```json
{
  "HealthCheck": {
    "Test": ["CMD", "bun", "run", "healthcheck"],
    "Interval": 30000000000,
    "Timeout":  10000000000,
    "StartPeriod": 20000000000,
    "Retries": 3
  },
  "UpdateConfig": {
    "Parallelism": 1,
    "Delay": 5000000000,
    "FailureAction": "rollback",
    "Order": "stop-first"
  },
  "RollbackConfig": {
    "Parallelism": 1,
    "Delay": 0,
    "FailureAction": "pause",
    "Order": "stop-first"
  }
}
```

### 2.4 `urlfy-migrate` — one-shot, no restart

- **Restart Policy**: `never` (or equivalent Dokploy "Run once" mode)
- **No HealthCheck** (container exits 0 on success, non-zero on failure)
- **No UpdateConfig** (not a long-running service)

### 2.5 `urlfy-geoip` — cron updater

- **Restart Policy**: `unless-stopped`
- No traffic port required
- Mounts `geoip_data` volume read-write

### 2.6 Health endpoint contract

Dokploy should treat the HTTP status code as authoritative and rely only on the aggregate `status` field. Do not parse or expose internal dependency details in health responses.

- API readiness: `GET /api/health/ready`
  - `200`: `{ "status": "ready" | "degraded", "timestamp": "<iso-8601>" }`
  - `503`: `{ "status": "not_ready", "timestamp": "<iso-8601>" }`
- Web readiness: `GET /ops/health/ready`
  - `200`: `{ "status": "ready" | "degraded", "component": "web", "timestamp": "<iso-8601>" }`
  - `503`: `{ "status": "not_ready", "component": "web", "timestamp": "<iso-8601>" }`

---

## 3. Image Sources

All images are built by `deploy.yml` and pushed to GHCR. Bootstrap each Dokploy Application with any valid GHCR reference, but expect CI to overwrite `dockerImage` with the immutable `release-*` reference before every production or staging deployment. The optional `:stable` tag remains available as a convenience channel for manual validation and recovery, not as the authoritative production deployment target.

| Application    | GHCR Image                                             | Port |
|----------------|--------------------------------------------------------|------|
| urlfy-api      | `ghcr.io/<owner>/urlfy-api:<release-tag>`              | 3001 |
| urlfy-web      | `ghcr.io/<owner>/urlfy-web:<release-tag>`              | 3000 |
| urlfy-worker   | `ghcr.io/<owner>/urlfy-worker:<release-tag>`           | —    |
| urlfy-migrate  | `ghcr.io/<owner>/urlfy-migrate:<release-tag>`          | —    |
| urlfy-geoip    | `ghcr.io/<owner>/urlfy-geoip:<release-tag>`            | —    |

> `urlfy-migrate` is published as its own GHCR image, but it shares the same Docker build graph as `urlfy-worker`. The dedicated image bakes `bun run db:migrate:prod` into the container contract, so Dokploy does not need any startup-command override.
>
> In Dokploy, enable **Deployments → Rollback Settings** against the same GHCR registry for `urlfy-api` and `urlfy-web` so per-application registry rollback remains available. The CI-generated `release-manifest.json` is still the authoritative cross-service rollback map.

For staging validation, `.github/workflows/deploy-staging.yml` updates each staging Application's `dockerImage` to the requested GHCR reference, for example `ghcr.io/<owner>/urlfy-api:release-...`, before calling `POST /api/application.deploy`. Passing `stable` repoints the staging Applications to the shared `:stable` channel tag instead of a release-specific image.

---

## 4. Networking

All five Applications attach to the **`dokploy-network`** overlay network (created automatically by Dokploy).  The API and Web services are also exposed through Traefik for public ingress.

**Same-origin routing** (Traefik rule on the Web Application):

- `Host('urlfy.cc') && PathPrefix('/api')` → route to `urlfy-api:3001`
- All other requests → `urlfy-web:3000`

This lets the browser hit a single origin for both the Next.js front-end and the Elysia API.

Set `API_INTERNAL_URL` on `urlfy-web` to the actual internal Dokploy service DNS name for the API Application, not to the public ingress URL. In a typical overlay this is the Dokploy/Docker service name, for example `http://urlfy-api:3001`, but the exact hostname depends on how the Application is named in your environment.

---

## 5. Volumes

| Volume Name  | Mount Path (in container)              | Applications           | Mode       |
|--------------|----------------------------------------|------------------------|------------|
| `geoip_data` | `/app/geoip` (api, web, worker)        | api, web, worker       | read-only  |
| `geoip_data` | `/geoip` (geoip updater)               | urlfy-geoip            | read-write |

Configure the shared named volume once in Dokploy and attach it to all four Applications.

On a fresh environment, bootstrap `urlfy-geoip` once before cutting traffic over to the new topology or pre-seed `geoip_data` with `GeoLite2-City.mmdb`. API, Web, and Worker degrade safely when the MMDB file is absent, but GeoIP enrichment remains unavailable until the first successful refresh.

---

## 6. Environment Variables

### 6.1 `urlfy-api`

| Variable                 | Required | Notes                                                              |
|--------------------------|----------|--------------------------------------------------------------------|
| `DATABASE_URL`           | ✅        | PostgreSQL connection string                                       |
| `NEXT_PUBLIC_APP_URL`    | ✅        | Public origin; keep aligned with Web runtime and `BETTER_AUTH_URL` |
| `BETTER_AUTH_SECRET`     | ✅        | Min 32 chars — must match web                                      |
| `BETTER_AUTH_URL`        | —        | Defaults to `NEXT_PUBLIC_APP_URL`; keep aligned when set           |
| `INTERNAL_API_SECRET`    | ✅        | Min 16 chars — must match web + worker                             |
| `ADMIN_GITHUB_ACCOUNT_ID`| —        | GitHub numeric account ID for admin elevation; admin routes are inaccessible without it |
| `INTERNAL_ANALYTICS_SECRET` | ✅    | Shared secret between API and worker for analytics events          |
| `JWT_SECRET`             | ✅        | Required in production for password-protected links                |
| `REDIS_URL`              | ✅        | Redis connection URL                                               |
| `TRUST_PROXY`            | ✅        | `true` — Traefik sits in front                                     |
| `TRUST_PROXY_PROVIDER`   | ✅        | `cloudflare` — Cloudflare → Traefik → app topology; reads `CF-Connecting-IP` |
| `TRUST_PROXY_HOPS`       | —        | Default `1`; only relevant when `TRUST_PROXY_PROVIDER` is not set  |
| `TRUSTED_PROXY_CIDRS`    | —        | Optional CIDR allowlist; invalid entries are rejected at startup   |
| `GEOIP_DB_PATH`          | —        | Default `/app/geoip/GeoLite2-City.mmdb`                           |
| `IDEMPOTENCY_GUEST_SECRET` | —      | Min 32 chars; falls back to `INTERNAL_API_SECRET` when absent      |
| `RESEND_API_KEY`         | —        | Resend API key — required for email delivery (verification, reset, LGPD) |
| `RESEND_FROM`            | —        | Sender address for transactional emails (e.g. `noreply@urlfy.cc`)  |
| `TELEGRAM_BOT_TOKEN`     | —        | Bot token for contact-form Telegram notifications                  |
| `TELEGRAM_CHAT_ID`       | —        | Target chat/channel ID for Telegram notifications                  |
| `GITHUB_CLIENT_ID`       | —        | OAuth: GitHub                                                      |
| `GITHUB_CLIENT_SECRET`   | —        | OAuth: GitHub                                                      |
| `GOOGLE_CLIENT_ID`       | —        | OAuth: Google                                                      |
| `GOOGLE_CLIENT_SECRET`   | —        | OAuth: Google                                                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | —   | Base OTLP endpoint (SigNoz / Grafana LGTM); per-signal overrides take precedence |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | — | Per-signal override for logs (consumed by `@urlfy/telemetry`)  |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | — | Per-signal override for metrics                             |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | — | Per-signal override for traces                              |
| `OTEL_EXPORTER_OTLP_HEADERS` | —    | Default auth headers for all signals (`key=value,key2=value2`)     |
| `OTEL_EXPORTER_OTLP_LOGS_HEADERS` | — | Per-signal auth headers for logs                               |
| `OTEL_EXPORTER_OTLP_METRICS_HEADERS` | — | Per-signal auth headers for metrics                          |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS` | — | Per-signal auth headers for traces                           |
| `OTEL_SERVICE_NAME`      | —        | Default `urlfy-api`                                                |

### 6.2 `urlfy-web`

| Variable                 | Required | Notes                                                              |
|--------------------------|----------|--------------------------------------------------------------------|
| `DATABASE_URL`           | ✅        | Must match API (Better Auth shares the same DB)                    |
| `NEXT_PUBLIC_APP_URL`    | ✅        | Must be passed as both the Web build arg and runtime env           |
| `BETTER_AUTH_SECRET`     | ✅        | Must match API                                                     |
| `BETTER_AUTH_URL`        | —        | Defaults to `NEXT_PUBLIC_APP_URL`; keep aligned when set           |
| `INTERNAL_API_SECRET`    | ✅        | Must match API                                                     |
| `INTERNAL_ANALYTICS_SECRET` | ✅    | Required in production; must match API + worker                    |
| `JWT_SECRET`             | ✅        | Required in production for password-protected links                |
| `REDIS_URL`              | ✅        |                                                                    |
| `API_INTERNAL_URL`       | ✅        | Set to the internal Dokploy / Swarm API address                    |
| `TRUST_PROXY`            | ✅        | `true`                                                             |
| `TRUST_PROXY_PROVIDER`   | ✅        | `cloudflare` — Cloudflare → Traefik → app topology                 |
| `TRUST_PROXY_HOPS`       | —        | Default `1`; only relevant when `TRUST_PROXY_PROVIDER` is not set  |
| `TRUSTED_PROXY_CIDRS`    | —        | Optional CIDR allowlist; invalid entries are rejected at startup   |
| `GEOIP_DB_PATH`          | —        | Default `/app/geoip/GeoLite2-City.mmdb`                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | —   |                                                                    |
| `OTEL_SERVICE_NAME`      | —        | Default `urlfy-web`                                                |

> `NEXT_PUBLIC_APP_URL` is both a **build-time** and **runtime** contract. Rebuild the Web image when it changes, and update the runtime env in Dokploy at the same time so server-side auth, readiness, and redirect flows stay aligned with the rendered origin.

### 6.3 `urlfy-worker`

| Variable                 | Required | Notes                                                              |
|--------------------------|----------|--------------------------------------------------------------------|
| `DATABASE_URL`           | ✅        |                                                                    |
| `REDIS_URL`              | ✅        |                                                                    |
| `INTERNAL_API_SECRET`    | ✅        |                                                                    |
| `INTERNAL_ANALYTICS_SECRET` | ✅    |                                                                    |
| `GEOIP_DB_PATH`          | —        | Default `/app/geoip/GeoLite2-City.mmdb`                           |
| `TRUST_PROXY`            | —        | Only needed when worker-side code trusts proxy headers             |
| `TRUST_PROXY_PROVIDER`   | —        | Optional `cloudflare` override for shared proxy-aware helpers      |
| `TRUST_PROXY_HOPS`       | —        | Default `1`                                                        |
| `TRUSTED_PROXY_CIDRS`    | —        | Optional CIDR allowlist; invalid entries are rejected at startup   |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | —   |                                                                    |
| `OTEL_SERVICE_NAME`      | —        | Default `urlfy-worker`                                             |

### 6.4 `urlfy-migrate`

`urlfy-migrate` uses a dedicated image whose default command is already `bun run db:migrate:prod`. The migration script waits for PostgreSQL before running Drizzle migrations, so its timeout knobs belong to the deployment contract.

| Variable                 | Required |
|--------------------------|----------|
| `DATABASE_URL`           | ✅        |
| `MIGRATION_TIMEOUT`      | —        |
| `DB_CHECK_TIMEOUT`       | —        |
| `SKIP_MIGRATIONS`        | —        |

### 6.5 `urlfy-geoip`

The GeoIP container downloads the GeoLite2-City MMDB from a public jsDelivr CDN mirror — no MaxMind credentials are required.

| Variable           | Required | Default                                                              | Notes                                        |
|--------------------|----------|----------------------------------------------------------------------|----------------------------------------------|
| `GEOIP_DB_PATH`    | —        | `/app/geoip/GeoLite2-City.mmdb`                                     | Path where the MMDB file is written          |
| `GEOIP_MAX_AGE_DAYS` | —      | `25`                                                                 | Re-download if the file is older than this   |
| `GEOIP_MMDB_URL`   | —        | `https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz` | CDN mirror URL for the compressed MMDB       |

---

## 7. CI Secrets and Variables Checklist

Configure these in **GitHub Settings → Secrets and variables → Actions** before setting `DOKPLOY_DEPLOY_ENABLED = true`.

### Repository Variables

| Name                    | Example / Notes                              |
|-------------------------|----------------------------------------------|
| `NEXT_PUBLIC_APP_URL`   | `https://urlfy.cc` — baked into web image     |
| `DOKPLOY_DEPLOY_ENABLED`| `true` to activate production deployments     |
| `DOKPLOY_STAGING_DEPLOY_ENABLED` | `true` to activate staging deployments |

### Repository Secrets (Production)

| Name                        | Description                                   |
|-----------------------------|-----------------------------------------------|
| `DOKPLOY_API_URL`           | `https://your-dokploy-server.example.com`     |
| `DOKPLOY_API_KEY`           | Dokploy API token                             |
| `DOKPLOY_APP_ID_MIGRATE`    | `applicationId` from Dokploy dashboard        |
| `DOKPLOY_APP_ID_API`        | `applicationId` from Dokploy dashboard        |
| `DOKPLOY_APP_ID_WEB`        | `applicationId` from Dokploy dashboard        |
| `DOKPLOY_APP_ID_WORKER`     | `applicationId` from Dokploy dashboard        |
| `PRODUCTION_APP_URL`        | `https://urlfy.cc`                            |

> **How to find `applicationId`**: In Dokploy, open the Application → Settings → General. The ID is shown in the URL or the General settings panel.

### Repository Secrets (Staging — optional)

| Name                              | Description                                |
|-----------------------------------|--------------------------------------------|
| `DOKPLOY_STAGING_API_URL`         | Staging Dokploy server URL                 |
| `DOKPLOY_STAGING_API_KEY`         | Staging Dokploy API token                  |
| `DOKPLOY_STAGING_APP_ID_MIGRATE`  |                                            |
| `DOKPLOY_STAGING_APP_ID_API`      |                                            |
| `DOKPLOY_STAGING_APP_ID_WEB`      |                                            |
| `DOKPLOY_STAGING_APP_ID_WORKER`   |                                            |
| `STAGING_APP_URL`                 | `https://staging.urlfy.cc`                 |

---

## 8. Migration Mode (Initial Rollout)

During the cutover from `docker-compose.prod.yml` to independent Dokploy Applications:

1. **Leave `DOKPLOY_DEPLOY_ENABLED` unset** — the `deploy.yml` workflow will build and push images to GHCR but skip all Dokploy API calls.
2. Provision the five Dokploy Applications manually using the image references from `release-manifest.json` on the GitHub Release.
3. Validate health checks, same-origin routing, and traffic in Dokploy before setting `DOKPLOY_DEPLOY_ENABLED = true`. The smoke test uses the deterministic `repo` link seeded by `db:migrate:prod` — no additional secrets needed.
4. From that point forward, every `release-*` tag triggers a fully automated ordered deployment.

The old `docker/docker-compose.prod.yml` is preserved as a rollback baseline — see `docs/operations/rollback-playbook.md`.
