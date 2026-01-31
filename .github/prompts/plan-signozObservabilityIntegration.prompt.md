# Plan: SigNoz Observability Integration

## Context

The urlfy.cc codebase already has **full OpenTelemetry instrumentation** implemented:

| File                            | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `src/server/lib/telemetry.ts`   | Full Node.js OTel SDK with traces, metrics, and logs |
| `src/server/lib/edge-logger.ts` | Lightweight edge-compatible logger for Middleware    |
| `src/server/lib/metrics.ts`     | Custom metrics (counters, histograms, gauges)        |
| `src/server/init.ts`            | Initializes telemetry on server startup              |
| `instrumentation.ts`            | Next.js instrumentation hook that triggers init      |

**What's missing:** Docker infrastructure for SigNoz backend and proper environment variable wiring.

---

## Architecture Overview

SigNoz requires a multi-service stack:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SIGNOZ STACK                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  Zookeeper   │  │  ClickHouse  │  │   SigNoz     │                  │
│  │   (3.7.1)    │◄─┤   (25.5.6)   │◄─┤  Query Svc   │                  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘                  │
│                                              │                          │
│                    ┌─────────────────────────┼─────────────────────┐   │
│                    │                         ▼                     │   │
│                    │  ┌──────────────────────────────────────┐    │   │
│                    │  │       OTEL Collector                 │    │   │
│                    │  │  ┌─────────┐  ┌─────────┐            │    │   │
│                    │  │  │  :4317  │  │  :4318  │            │    │   │
│                    │  │  │  gRPC   │  │  HTTP   │            │    │   │
│                    │  │  └────▲────┘  └────▲────┘            │    │   │
│                    │  └───────┼────────────┼─────────────────┘    │   │
│                    │          │            │                       │   │
│                    └──────────┼────────────┼───────────────────────┘   │
│                               │            │                           │
│  ┌────────────────────────────┼────────────┼───────────────────────┐  │
│  │                    signoz-net           │                       │  │
│  └────────────────────────────┼────────────┼───────────────────────┘  │
│                               │            │                           │
└───────────────────────────────┼────────────┼───────────────────────────┘
                                │            │
┌───────────────────────────────┼────────────┼───────────────────────────┐
│                       URLFY STACK          │                           │
│                               │            │                           │
│  ┌────────────────────────────▼────────────▼───────────────────────┐  │
│  │                        APP (Next.js + Elysia)                   │  │
│  │  OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │  PostgreSQL  │  │    Redis     │                                    │
│  └──────────────┘  └──────────────┘                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    urlfy-network                                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Port Mapping:**

| Service        | Port   | Protocol | Purpose                          |
| -------------- | ------ | -------- | -------------------------------- |
| SigNoz UI      | `8080` | HTTP     | Dashboard & alerting             |
| OTEL Collector | `4317` | gRPC     | OTLP gRPC receiver               |
| OTEL Collector | `4318` | HTTP     | OTLP HTTP receiver (used by app) |
| ClickHouse     | `9000` | TCP      | Internal DB (not exposed)        |

---

## Implementation Tasks

### Task 1: Create SigNoz Docker Compose Override

**File:** `docker/docker-compose.signoz.yml`

This file bridges the urlfy app with SigNoz's network. SigNoz runs in its own compose stack (official repo) and exposes `signoz-net`.

```yaml
# ═══════════════════════════════════════════════════════════════════
# SIGNOZ INTEGRATION OVERRIDE
# ═══════════════════════════════════════════════════════════════════
# Usage:
#   1. Start SigNoz first:
#      git clone https://github.com/SigNoz/signoz.git ../signoz
#      cd ../signoz/deploy/docker && docker compose up -d
#
#   2. Then start urlfy with this override:
#      docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
#
# Prerequisites:
#   - SigNoz stack running (creates signoz-net network)
#   - Minimum 4GB RAM allocated to Docker

services:
  app:
    environment:
      # OpenTelemetry configuration
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
      - OTEL_SERVICE_NAME=urlfy-api
      - OTEL_SERVICE_VERSION=${OTEL_SERVICE_VERSION:-0.0.0}
      - OTEL_TRACES_SAMPLER=parentbased_traceidratio
      - OTEL_TRACES_SAMPLER_ARG=1.0
      # Enable telemetry
      - TELEMETRY_ENABLED=true
    networks:
      - urlfy-network
      - signoz-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

# ═════════════════════════════════════════════════════════════════════
# NETWORKS
# ═════════════════════════════════════════════════════════════════════
networks:
  urlfy-network:
    name: urlfy-network
  signoz-net:
    external: true
    name: signoz-net
```

**Type Safety Note:** All environment variables must match the schema in `src/lib/env.ts`. Verify the following variables are declared:

```typescript
// src/lib/env.ts - ensure these are defined
export const env = createEnv({
  server: {
    // ... existing vars
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SERVICE_NAME: z.string().default('urlfy-api'),
    OTEL_SERVICE_VERSION: z.string().optional(),
    TELEMETRY_ENABLED: z.coerce.boolean().default(false)
  }
});
```

---

### Task 2: Update Base Docker Compose

**File:** `docker/docker-compose.yml`

Add optional OTEL environment variables to `app` service (empty defaults for standalone mode):

```yaml
# In app service, add to environment section:
environment:
  # ... existing vars ...
  # OpenTelemetry (optional - enabled when using docker-compose.signoz.yml)
  - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-}
  - OTEL_SERVICE_NAME=${OTEL_SERVICE_NAME:-urlfy-api}
  - OTEL_SERVICE_VERSION=${OTEL_SERVICE_VERSION:-0.0.0}
  - TELEMETRY_ENABLED=${TELEMETRY_ENABLED:-false}
```

**Remove unused volume:** The current `docker-compose.yml` references `signoz_data` volume but has no SigNoz service. Either:

- Remove `signoz_data` from volumes section (SigNoz manages its own volumes)
- Or keep for future embedded SigNoz approach

---

### Task 3: Create SigNoz Setup Documentation

**File:** `docs/architecture/signoz-setup.md`

````markdown
# SigNoz Observability Setup

## Overview

urlfy.cc uses [SigNoz](https://signoz.io) for unified observability (traces, metrics, logs).
The application includes full OpenTelemetry instrumentation out of the box.

## Prerequisites

- Docker with minimum **4GB RAM** allocated
- Docker Compose v2.x
- ~3GB disk space for ClickHouse data

> ⚠️ **Windows Users:** SigNoz is not officially supported on Windows.
> Use WSL2 with Docker Desktop configured to use WSL2 backend.

## Quick Start

### 1. Clone SigNoz Repository

```bash
# From urlfy.cc root directory
git clone https://github.com/SigNoz/signoz.git ../signoz
```
````

### 2. Start SigNoz Stack

```bash
cd ../signoz/deploy/docker
docker compose up -d
```

Wait for all services to be healthy (~2-3 minutes on first run):

```bash
docker compose ps
```

Expected output:

```
NAME                    STATUS
signoz-clickhouse       Up (healthy)
signoz-otel-collector   Up
signoz-signoz           Up (healthy)
signoz-zookeeper-1      Up (healthy)
```

### 3. Start urlfy with SigNoz Integration

```bash
cd /path/to/urlfy.cc/docker
docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
```

### 4. Access SigNoz Dashboard

Open [http://localhost:8080](http://localhost:8080) in your browser.

Default credentials: Create on first access.

## Telemetry Configuration

### Environment Variables

| Variable                      | Default     | Description             |
| ----------------------------- | ----------- | ----------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | -           | SigNoz collector URL    |
| `OTEL_SERVICE_NAME`           | `urlfy-api` | Service name in traces  |
| `OTEL_SERVICE_VERSION`        | `0.0.0`     | Semantic version        |
| `TELEMETRY_ENABLED`           | `false`     | Enable OTel export      |
| `OTEL_TRACES_SAMPLER_ARG`     | `1.0`       | Sampling rate (0.0-1.0) |

### Custom Metrics Exported

| Metric                   | Type      | Labels                | Description            |
| ------------------------ | --------- | --------------------- | ---------------------- |
| `urlfy.redirect.latency` | Histogram | `cache_hit`, `status` | Redirect latency in ms |
| `urlfy.cache.operations` | Counter   | `operation`, `result` | Cache hits/misses      |
| `urlfy.queue.pending`    | Gauge     | `queue_name`          | Pending jobs in queue  |
| `urlfy.db.query.latency` | Histogram | `operation`           | Database query latency |
| `urlfy.links.created`    | Counter   | `user_type`           | Links created          |

## Production Considerations

### Sampling Strategy

For high-traffic production, reduce sampling rate:

```yaml
# docker-compose.signoz.yml
environment:
  - OTEL_TRACES_SAMPLER_ARG=0.1 # Sample 10% of traces
```

### Resource Limits

SigNoz ClickHouse can grow significantly. Set limits:

```yaml
# In signoz/deploy/docker/docker-compose.yaml
clickhouse:
  deploy:
    resources:
      limits:
        memory: 4G
```

### Data Retention

Default retention: 7 days (traces/logs), 30 days (metrics).

Configure in SigNoz UI: Settings → General → Retention Period.

## Troubleshooting

### No Data in SigNoz

1. Verify network connectivity:

   ```bash
   docker compose exec app ping signoz-otel-collector
   ```

2. Check OTEL exporter logs:

   ```bash
   docker compose logs app | grep -i otel
   ```

3. Verify collector is receiving data:
   ```bash
   docker logs signoz-otel-collector 2>&1 | grep "TracesExporter"
   ```

### High Memory Usage

ClickHouse uses significant memory for queries. Recommendations:

- Increase Docker memory limit to 6GB+
- Reduce retention period
- Enable trace sampling

## Alert Rules (SLO-based)

Configure these alerts in SigNoz UI (Alerts → New Alert):

### Redirect Latency P99

```yaml
alert: HighRedirectLatency
expr: histogram_quantile(0.99, sum(rate(urlfy_redirect_latency_bucket[5m])) by (le)) > 300
for: 5m
severity: warning
annotations:
  summary: 'Redirect P99 latency exceeds 300ms'
```

### Error Rate

```yaml
alert: HighErrorRate
expr: sum(rate(urlfy_http_requests_total{status=~"5.."}[5m])) / sum(rate(urlfy_http_requests_total[5m])) > 0.01
for: 5m
severity: critical
annotations:
  summary: 'Error rate exceeds 1%'
```

### Cache Hit Rate

```yaml
alert: LowCacheHitRate
expr: sum(rate(urlfy_cache_operations_total{result="hit"}[10m])) / sum(rate(urlfy_cache_operations_total[10m])) < 0.7
for: 10m
severity: warning
annotations:
  summary: 'Cache hit rate below 70%'
```

````

---

### Task 4: Update Architecture Overview

**File:** `docs/architecture/overview.md`

Update the SigNoz section in the Docker Compose block to reflect actual multi-container setup:

```yaml
# Replace the placeholder signoz service with comment:

  # ═══════════════════════════════════════════════════════════════════
  # SIGNOZ (Observability) - EXTERNAL STACK
  # ═══════════════════════════════════════════════════════════════════
  # SigNoz runs as a separate Docker Compose stack due to its complexity
  # (ClickHouse, Zookeeper, Schema Migrator, Query Service, OTEL Collector).
  #
  # To enable observability:
  #   1. Clone SigNoz: git clone https://github.com/SigNoz/signoz.git ../signoz
  #   2. Start SigNoz: cd ../signoz/deploy/docker && docker compose up -d
  #   3. Start urlfy with override:
  #      docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
  #
  # See docs/architecture/signoz-setup.md for detailed instructions.
  # ═══════════════════════════════════════════════════════════════════
````

---

### Task 5: Verify Environment Variable Schema

**File:** `src/lib/env.ts`

Ensure these OTEL-related variables are properly typed:

```typescript
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // ... existing variables ...

    // ═══════════════════════════════════════════════════════════════
    // OPENTELEMETRY / OBSERVABILITY
    // ═══════════════════════════════════════════════════════════════

    /**
     * OTLP exporter endpoint (SigNoz collector URL)
     * @example "http://signoz-otel-collector:4318"
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

    /**
     * Service name for traces/metrics
     * @default "urlfy-api"
     */
    OTEL_SERVICE_NAME: z.string().default('urlfy-api'),

    /**
     * Semantic version for service versioning in traces
     */
    OTEL_SERVICE_VERSION: z.string().optional(),

    /**
     * Master switch to enable/disable telemetry export
     * @default false
     */
    TELEMETRY_ENABLED: z
      .string()
      .transform((val) => val === 'true')
      .default('false'),

    /**
     * Enable verbose OTel diagnostics (development only)
     * @default false
     */
    OTEL_DEBUG: z
      .string()
      .transform((val) => val === 'true')
      .default('false')
  }

  // ... runtimeEnv, etc.
});
```

---

### Task 6: Update Telemetry Initialization Guard

**File:** `src/server/lib/telemetry.ts`

Ensure telemetry only initializes when properly configured:

```typescript
import { env } from '@/lib/env';

/**
 * Initialize OpenTelemetry SDK
 * Only runs when TELEMETRY_ENABLED=true AND OTEL_EXPORTER_OTLP_ENDPOINT is set
 */
export function initTelemetry(): void {
  // Guard: Don't initialize if not enabled
  if (!env.TELEMETRY_ENABLED) {
    console.log('[Telemetry] Disabled (TELEMETRY_ENABLED=false)');
    return;
  }

  // Guard: Don't initialize without endpoint
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.warn(
      '[Telemetry] Enabled but OTEL_EXPORTER_OTLP_ENDPOINT not set. Skipping initialization.'
    );
    return;
  }

  console.log(
    `[Telemetry] Initializing with endpoint: ${env.OTEL_EXPORTER_OTLP_ENDPOINT}`
  );

  // ... rest of initialization
}
```

---

### Task 7: Add npm Scripts for Convenience

**File:** `package.json`

Add convenience scripts for managing observability stack:

```json
{
  "scripts": {
    // ... existing scripts ...

    "signoz:clone": "git clone https://github.com/SigNoz/signoz.git ../signoz",
    "signoz:up": "cd ../signoz/deploy/docker && docker compose up -d",
    "signoz:down": "cd ../signoz/deploy/docker && docker compose down",
    "signoz:logs": "cd ../signoz/deploy/docker && docker compose logs -f",

    "docker:up:observability": "docker compose -f docker/docker-compose.yml -f docker/docker-compose.signoz.yml up -d",
    "docker:down:observability": "docker compose -f docker/docker-compose.yml -f docker/docker-compose.signoz.yml down"
  }
}
```

---

### Task 8: Clean Up Unused Volume Reference

**File:** `docker/docker-compose.yml`

Remove `signoz_data` from volumes section since SigNoz manages its own volumes:

```yaml
# REMOVE from volumes section:
volumes:
  postgres_data:
    name: urlfy_postgres_data
  redis_data:
    name: urlfy_redis_data
  # signoz_data:           # ← REMOVE THIS
  #   name: urlfy_signoz_data  # ← REMOVE THIS
  geoip_data:
    name: urlfy_geoip_data
  backup_data:
    name: urlfy_backup_data
```

---

## Verification Checklist

After implementation, verify:

- [ ] `docker-compose.signoz.yml` created with proper network bridging
- [ ] Environment variables added to base `docker-compose.yml`
- [ ] `src/lib/env.ts` has all OTEL variables typed with Zod
- [ ] Telemetry guard checks both `TELEMETRY_ENABLED` and endpoint
- [ ] Documentation created at `docs/architecture/signoz-setup.md`
- [ ] npm scripts added for convenience
- [ ] Unused `signoz_data` volume removed

## Testing Steps

1. **Start SigNoz stack:**

   ```bash
   bun run signoz:clone
   bun run signoz:up
   ```

2. **Wait for healthy status:**

   ```bash
   docker ps --filter "name=signoz"
   ```

3. **Start urlfy with observability:**

   ```bash
   bun run docker:up:observability
   ```

4. **Generate traffic:**

   ```bash
   curl http://localhost:3000/api/health
   curl -X POST http://localhost:3000/api/links -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
   ```

5. **Verify in SigNoz UI:**
   - Open http://localhost:8080
   - Navigate to Services → `urlfy-api`
   - Verify traces appear with proper spans

6. **Check metrics:**
   - Navigate to Dashboards
   - Search for `urlfy.redirect.latency` metric

---

## Security Considerations

1. **Network isolation:** SigNoz services should not be exposed externally in production. Use reverse proxy (nginx/traefik) with authentication.

2. **Retention policy:** Configure appropriate retention in SigNoz UI to prevent disk exhaustion. Default: 7 days traces, 30 days metrics.

3. **Sampling in production:** Set `OTEL_TRACES_SAMPLER_ARG=0.1` (10% sampling) for high-traffic scenarios to reduce storage costs.

4. **Sensitive data:** Ensure no PII is included in trace attributes. The current implementation hashes IPs before logging.

---

## References

- [SigNoz Docker Installation](https://signoz.io/docs/install/docker/)
- [OpenTelemetry Node.js SDK](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [SigNoz Alert Configuration](https://signoz.io/docs/alerts/)
- [urlfy.cc Architecture Overview](./overview.md)
