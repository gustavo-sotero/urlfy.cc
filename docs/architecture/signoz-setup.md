# SigNoz Observability Setup

> 📖 [← Voltar ao Overview](./overview.md) | [Caching →](./caching-strategy.md)

**Navegação:** [Overview](./overview.md) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](./security.md) · [SigNoz](#) · [API](../api/endpoints.md)

---

## Overview

urlfy.cc uses [SigNoz](https://signoz.io) for unified observability (traces, metrics, logs).
The application includes full OpenTelemetry instrumentation out of the box.

### Architecture

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

## Prerequisites

- Docker with minimum **4GB RAM** allocated
- Docker Compose v2.x
- ~3GB disk space for ClickHouse data

> ⚠️ **Windows Users:** SigNoz is not officially supported on Windows.
> Use WSL2 with Docker Desktop configured to use WSL2 backend.

---

## Quick Start

### 1. One-command setup (recommended)

```bash
bun run observability:up
```

> ⚠️ **Windows note:** Docker Desktop must be running with WSL2 backend enabled, otherwise the command will fail.

This command:

1. Clones SigNoz (if missing)
2. Starts the SigNoz stack
3. Starts urlfy with the SigNoz override compose

To stop everything:

```bash
bun run observability:down
```

---

### 2. Clone SigNoz Repository (manual)

```bash
# From urlfy.cc root directory
git clone https://github.com/SigNoz/signoz.git ../signoz
```

Or use the convenience script:

```bash
bun run signoz:clone
```

### 3. Start SigNoz Stack

```bash
cd ../signoz/deploy/docker
docker compose up -d
```

Or use the convenience script:

```bash
bun run signoz:up
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

### 4. Start urlfy with SigNoz Integration

```bash
cd /path/to/urlfy.cc/docker
docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
```

Or use the convenience script:

```bash
bun run docker:up:observability
```

### 5. Access SigNoz Dashboard

Open [http://localhost:8080](http://localhost:8080) in your browser.

Default credentials: Create on first access.

### 6. Validation Checklist

After starting both SigNoz and urlfy, verify the integration is working:

**Step 1: Check Telemetry Initialization**

```bash
# View app startup logs
docker compose logs app | grep -i telemetry

# Expected output:
# [Telemetry] ✅ Initialized with endpoint: http://signoz-otel-collector:4318
# [Telemetry] Service: urlfy-api
```

**Step 2: Generate Test Traffic**

```bash
# Make a request to generate telemetry data
curl http://localhost:3000/api/health

# Or visit http://localhost:3000 in your browser
```

**Step 3: Verify in SigNoz UI**

1. Open [http://localhost:8080](http://localhost:8080)
2. Navigate to **Services** tab (left sidebar)
3. Look for `urlfy-api` in the services list
4. Click on `urlfy-api` to view traces

**Expected:** You should see traces appearing within 10-30 seconds of making requests.

**Step 4: Check Metrics**

1. In SigNoz UI, go to **Dashboard** tab
2. Create a new panel with metric: `http.server.request.duration`
3. Filter by `service.name = urlfy-api`

**Step 5: Check Logs**

1. Go to **Logs** tab
2. Filter by `service.name = urlfy-api`
3. You should see structured logs from the application

**If No Data Appears:** See [Troubleshooting](#troubleshooting) section below.

---

## Telemetry Configuration

### Environment Variables

| Variable                      | Default     | Description             |
| ----------------------------- | ----------- | ----------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | -           | SigNoz collector URL    |
| `OTEL_SERVICE_NAME`           | `urlfy-api` | Service name in traces  |
| `OTEL_SERVICE_VERSION`        | `0.0.0`     | Semantic version        |
| `TELEMETRY_ENABLED`           | `false`     | Enable OTel export      |
| `OTEL_TRACES_SAMPLER_ARG`     | `1.0`       | Sampling rate (0.0-1.0) |
| `OTEL_DEBUG`                  | `false`     | Enable verbose logging  |

### Custom Metrics Exported

| Metric                   | Type      | Labels                | Description            |
| ------------------------ | --------- | --------------------- | ---------------------- |
| `urlfy.redirect.latency` | Histogram | `cache_hit`, `status` | Redirect latency in ms |
| `urlfy.cache.operations` | Counter   | `operation`, `result` | Cache hits/misses      |
| `urlfy.queue.pending`    | Gauge     | `queue_name`          | Pending jobs in queue  |
| `urlfy.db.query.latency` | Histogram | `operation`           | Database query latency |
| `urlfy.links.created`    | Counter   | `user_type`           | Links created          |

---

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

---

## Troubleshooting

### No Data in SigNoz

**Symptoms:** SigNoz dashboard shows no services or traces after starting the application.

**Root Causes & Solutions:**

#### 1. OTLP Endpoint URL Misconfiguration

The OTLP/HTTP specification requires `/v1/` prefix for all signal types. Verify the exporter URLs in `packages/telemetry/src/init.ts` include:

- Traces: `/v1/traces`
- Metrics: `/v1/metrics`
- Logs: `/v1/logs`

**Correct Configuration:**

```typescript
const traceExporter = new OTLPTraceExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
});
```

**Verification:**

```bash
# Check app startup logs for successful telemetry initialization
docker compose logs app | grep -i telemetry
# Expected: [Telemetry] ✅ Initialized with endpoint: http://signoz-otel-collector:4318
```

#### 2. Network Connectivity Issues

**Verify Docker Network Configuration:**

```bash
# 1. Check if signoz-net network exists
docker network ls | grep signoz

# Expected output (name may vary):
# abc123def456   signoz-net   bridge   local
# OR
# abc123def456   docker_default   bridge   local
```

If the network name differs from `signoz-net`, update `docker/docker-compose.signoz.yml`:

```yaml
networks:
  signoz-net:
    external: true
    name: <ACTUAL_NETWORK_NAME> # Use the name from docker network ls
```

**Verify App is Connected to Both Networks:**

```bash
# Inspect app container networks
docker inspect docker-app-1 | grep -A 10 "Networks"

# Expected output should show both:
# - urlfy-network
# - signoz-net (or the actual network name)
```

**Test Connectivity:**

```bash
# From app container to SigNoz collector
docker compose exec app ping -c 3 signoz-otel-collector

# If ping fails, restart both stacks:
cd ../signoz/deploy/docker && docker compose restart
cd /path/to/urlfy.cc/docker && docker compose -f docker-compose.yml -f docker-compose.signoz.yml restart
```

#### 3. Environment Variable Validation

**For Docker (Container-to-Container):**

```bash
# Verify OTEL_EXPORTER_OTLP_ENDPOINT is set correctly
docker compose exec app env | grep OTEL

# Expected for Docker:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
# TELEMETRY_ENABLED=true
```

**For Local Development (`bun dev`):**

```bash
# Check .env file has localhost endpoint
cat .env | grep OTEL

# Expected for local dev:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# TELEMETRY_ENABLED=true
```

#### 4. Check Exporter Logs

```bash
# Application logs
docker compose logs app | grep -i otel

# Look for:
# ✅ [Telemetry] ✅ Initialized with endpoint: ...
# ❌ Connection refused (wrong endpoint)
# ❌ 404 Not Found (missing /v1/ prefix)
```

#### 5. Verify SigNoz Collector is Running

```bash
# Check collector status
docker logs signoz-otel-collector 2>&1 | tail -50

# Expected: "Everything is ready. Begin running and processing data."

# Check if collector is receiving data
docker logs signoz-otel-collector 2>&1 | grep "TracesExporter"
```

### High Memory Usage

ClickHouse uses significant memory for queries. Recommendations:

- Increase Docker memory limit to 6GB+
- Reduce retention period
- Enable trace sampling

### Connection Refused Errors

If the app can't reach the SigNoz collector:

1. Ensure SigNoz is running: `docker compose ps` in signoz directory
2. Verify the `signoz-net` network exists: `docker network ls | grep signoz`
3. Check app is connected to both networks: `docker inspect docker-app-1`

---

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

---

## NPM Scripts Reference

| Script                              | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `bun run signoz:clone`              | Clone SigNoz repository to ../signoz     |
| `bun run signoz:up`                 | Start SigNoz stack                       |
| `bun run signoz:down`               | Stop SigNoz stack                        |
| `bun run signoz:logs`               | Tail SigNoz logs                         |
| `bun run observability:up`          | One-command setup (clone + up both)      |
| `bun run observability:down`        | Stop urlfy + SigNoz stacks               |
| `bun run docker:up:observability`   | Start urlfy with SigNoz integration      |
| `bun run docker:down:observability` | Stop urlfy with SigNoz integration       |
| `bun run docker:logs:observability` | Tail logs for urlfy with SigNoz override |
| `bun run docker:up:signoz`          | Alias for observability up               |
| `bun run docker:down:signoz`        | Alias for observability down             |
| `bun run docker:logs:signoz`        | Alias for observability logs             |

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
