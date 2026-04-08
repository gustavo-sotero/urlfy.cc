# Observability Setup (Grafana LGTM / OTLP Collector)

> 📖 [← Voltar ao Overview](./overview.md) | [Caching →](./caching-strategy.md)

**Navegação:** [Overview](./overview.md) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](./security.md) · [Observability](#) · [API](../api/endpoints.md)

> **Note:** This document previously described a self-hosted SigNoz setup. The current production backend is self-hosted **Grafana LGTM** (`grafana/otel-lgtm` Docker image). The application telemetry client (OTLP HTTP) is collector-agnostic — any OTLP-compatible backend (SigNoz, Grafana Cloud, Honeycomb, etc.) works with the same env vars.

---

## Overview

urlfy.cc uses [OpenTelemetry](https://opentelemetry.io/) for unified observability (traces, metrics, logs). All three signals are exported via **OTLP HTTP** from the shared `@urlfy/telemetry` package.

The shared telemetry package (`packages/telemetry/`) is the single canonical entrypoint for all observability across API, web, and worker services.

### Production Collector Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GRAFANA LGTM STACK (self-hosted)                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   grafana/otel-lgtm container                    │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │  OTel Coll.  │  │  Loki    │  │  Mimir   │  │   Tempo    │  │   │
│  │  │  :4317 gRPC  │  │  (logs)  │  │ (metrics)│  │  (traces)  │  │   │
│  │  │  :4318 HTTP  │  └──────────┘  └──────────┘  └────────────┘  │   │
│  │  └──────┬───────┘                                               │   │
│  │         │  ingests all signals                                  │   │
│  │  ┌──────▼───────────────────────────────┐                      │   │
│  │  │           Grafana UI (:3000)          │                      │   │
│  │  └───────────────────────────────────────┘                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            dokploy-network                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                         OTLP HTTP (port 4318)
                                    │
┌───────────────────────────────────┴───────────────────────────────────┐
│                         URLFY APPLICATION                              │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │
│  │  Next.js (web) │  │ Elysia (api)   │  │  Bun Workers (worker)  │   │
│  │  @urlfy/telemetry  @urlfy/telemetry   @urlfy/telemetry          │   │
│  └────────────────┘  └────────────────┘  └────────────────────────┘   │
│                                                                         │
│  OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Signal Paths

| Signal  | Endpoint Path | Receiver              |
| ------- | ------------- | --------------------- |
| Logs    | `/v1/logs`    | OTel Collector → Loki |
| Metrics | `/v1/metrics` | OTel Collector → Mimir|
| Traces  | `/v1/traces`  | OTel Collector → Tempo|

---

## Important: `ENABLE_LOGS_ALL` is NOT an Application Flag

The `grafana/otel-lgtm` Docker image supports an `ENABLE_LOGS_ALL=true` environment variable. This controls **internal component logging** (Grafana/Loki/Tempo/OTel Collector internal logs piped to stdout) for container-level troubleshooting.

It does **not** enable or disable application OTLP log ingestion.

Application logs arrive via the standard OTLP HTTP path (`POST /v1/logs`) regardless of `ENABLE_LOGS_ALL`. Setting `ENABLE_LOGS_ALL=true` will produce more verbose container logs in `docker logs lgtm` but will not fix missing application logs.

---

## Environment Variables

| Variable                                | Required | Default     | Description                                                  |
| --------------------------------------- | -------- | ----------- | ------------------------------------------------------------ |
| `TELEMETRY_ENABLED`                     | Yes      | `false`     | Enable OTLP export (traces, metrics, logs)                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT`           | Yes*     | —           | **Base URL** of OTLP HTTP collector, WITHOUT `/v1/*` suffix  |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`      | No       | —           | Per-signal override for logs (full URL, used as-is)          |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`   | No       | —           | Per-signal override for metrics (full URL, used as-is)       |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`    | No       | —           | Per-signal override for traces (full URL, used as-is)        |
| `OTEL_EXPORTER_OTLP_HEADERS`            | No       | —           | Comma-separated `key=value` HTTP headers for all exporters   |
| `OTEL_EXPORTER_OTLP_LOGS_HEADERS`       | No       | —           | Extra headers for logs only; overrides matching shared keys  |
| `OTEL_EXPORTER_OTLP_METRICS_HEADERS`    | No       | —           | Extra headers for metrics only; overrides matching shared keys |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS`     | No       | —           | Extra headers for traces only; overrides matching shared keys |
| `OTEL_SERVICE_NAME`                     | No       | `urlfy-api` | Service name in telemetry backend                            |
| `OTEL_SERVICE_VERSION`                  | No       | npm version | Service version (overrides embedded npm package version)     |
| `OTEL_DEBUG`                            | No       | `false`     | Enable OTel SDK internal diagnostics (dev only)              |

> *At least one of the base endpoint or a per-signal endpoint must be set when `TELEMETRY_ENABLED=true`.

### Endpoint Format

The base endpoint must be the **collector HTTP base URL** without any `/v1/*` signal path suffix. The application appends `/v1/logs`, `/v1/metrics`, and `/v1/traces` automatically. Trailing slashes are normalized.

```bash
# ✅ Correct — trailing slash is normalized automatically
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc/

# ✅ Also correct — no trailing slash
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc

# ✅ Correct — local dev with grafana/otel-lgtm on port 4318
OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318

# ❌ Wrong — do not include the signal suffix in the base endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc/v1/logs
```

### Per-Signal Override

Per-signal endpoint overrides are used **as-is** (no suffix is appended). Use these when different signals go to different backends:

```bash
# Send logs to a dedicated endpoint, traces/metrics to the base
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://logs-only.collector.urlfy.cc/v1/logs
```

### Header Overrides

Use `OTEL_EXPORTER_OTLP_HEADERS` for headers shared by all signals. When a signal needs additional headers or a different value for the same header key, use the signal-specific header env var for that signal. Signal-specific values override matching shared keys.

```bash
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64>,X-Scope-OrgID=default
OTEL_EXPORTER_OTLP_LOGS_HEADERS=X-Scope-OrgID=logs
```

---

## Production Collector Configuration (grafana/otel-lgtm)

Minimal recommended compose for the LGTM collector service in Dokploy:

```yaml
services:
  lgtm:
    image: grafana/otel-lgtm:latest
    volumes:
      - lgtm-data:/data
    environment:
      # This controls internal component logging (Grafana/Loki/Tempo/OTel Collector
      # internal diagnostics), NOT application OTLP log ingestion.
      - ENABLE_LOGS_ALL=true
    networks:
      - dokploy-network
    ports:
      - "3000"   # Grafana UI
      - "4318"   # OTLP HTTP receiver (app sends to this port)
networks:
  dokploy-network:
    external: true
volumes:
  lgtm-data:
```

Set `OTEL_EXPORTER_OTLP_ENDPOINT` in the urlfy services to point at this collector:

```bash
# In Dokploy environment variables
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.urlfy.cc
```

---

## Bootstrap Diagnostics

When telemetry starts, the application emits structured bootstrap log lines to stdout/stderr (before the LogTape pipeline is available). These are always present regardless of log level settings:

```json
{"level":"info","message":"Resolved OTLP signal endpoints","logger":"telemetry-bootstrap","timestamp":"...","traces":"https://collector.urlfy.cc/v1/traces","metrics":"https://collector.urlfy.cc/v1/metrics","logs":"https://collector.urlfy.cc/v1/logs","headers":"none"}
{"level":"info","message":"Telemetry initialized","logger":"telemetry-bootstrap","timestamp":"...","service":"urlfy-api","version":"0.1.0"}
{"level":"info","message":"LogTape logging configured","logger":"telemetry-bootstrap","timestamp":"...","sinks":["otel"],"telemetryActive":true,"isDev":false}
```

If `forceFlush()` fails during startup (e.g., collector unreachable at boot):

```json
{"level":"warn","message":"Bootstrap log forceFlush failed – logs may not export initially","logger":"telemetry-bootstrap","logsEndpoint":"https://collector.urlfy.cc/v1/logs","error":"..."}
```

After the LogTape pipeline is active, a pipeline probe record is emitted through the OTel sink to distinguish "pipeline initialized" from "no log records were ever produced":
```
logger: urlfy.telemetry | message: "Telemetry logging pipeline active"
```

---

## Custom Metrics Exported

| Metric                       | Type      | Labels                | Description               |
| ---------------------------- | --------- | --------------------- | ------------------------- |
| `urlfy.redirect.latency`     | Histogram | `cache_hit`, `status` | Redirect latency in ms    |
| `urlfy.cache.hits`           | Counter   | —                     | Cache hits                |
| `urlfy.cache.misses`         | Counter   | —                     | Cache misses              |
| `urlfy.circuit_breaker.trips`| Counter   | —                     | Circuit breaker trips     |
| `urlfy.redirect.errors`      | Counter   | —                     | Redirect errors           |
| `urlfy.stampede.locks`       | Counter   | —                     | Stampede lock acquisitions|

---

## Troubleshooting

### Logs appear in Grafana but are missing fields

Check that `OTEL_SERVICE_NAME` is set per service in the compose file. Each service (`api`, `web`, `worker`) should have a distinct name so logs can be filtered by service in Grafana Explore.

### No logs in Grafana despite traces and metrics working

Traces and metrics can be healthy while logs fail silently because logs rely on a separate `LoggerProvider` pipeline (LogTape → OTel sink → `BatchLogRecordProcessor` → `OTLPLogExporter`).

Checklist:
1. Check bootstrap diagnostics for `"Resolved OTLP signal endpoints"` — confirm the logs endpoint is correct and has no double-slash (e.g., `https://collector.urlfy.cc//v1/logs` would be wrong).
2. Check for `"Bootstrap log forceFlush failed"` in container startup logs — this means the collector was unreachable at boot and the first batch may have been lost.
3. Run `bun run scripts/validate-opentelemetry.ts` — Step 10 checks for OTel version skew between `packages/telemetry` and root; skew silently breaks the log pipeline.
4. Verify the LGTM collector is receiving POST requests to `/v1/logs` — not getting there at all points to a proxy/ingress issue, not an app-side issue.
5. In Grafana Explore, check Loki and query `{service_name="urlfy-api"}` (or the exporter attribute label) — Loki may be receiving logs but displaying them under unexpected labels.

### `ENABLE_LOGS_ALL` not working as expected

`ENABLE_LOGS_ALL=true` on the `grafana/otel-lgtm` container only increases verbosity of the **internal** LGTM stack components in the container's stdout. It is not a switch for application OTLP ingestion. Application logs sent via OTLP HTTP will still be ingested regardless.

### Endpoint construction produces double-slash URLs

The application normalizes trailing slashes on the base endpoint before appending signal suffixes. If you see `//v1/logs` in error logs, ensure you are running the current version of `packages/telemetry/src/init.ts` (post-2026-04-08).

Verify: `bun run scripts/validate-opentelemetry.ts` — Step 10 must pass.

### Collector receiving logs but they do not appear in Grafana

This is typically a Loki label or stream configuration issue, not an ingestion failure. Verify:
- The collector is running the latest `grafana/otel-lgtm` image.
- Query Grafana Explore → Loki with `{}` (no filters) to see all streams currently indexed.
- Check if logs are indexed with a different resource attribute label than expected.

---

## Historical Note: SigNoz

Prior to 2026-04-08, urlfy.cc used a self-hosted [SigNoz](https://signoz.io) instance as the observability backend. SigNoz also accepts OTLP HTTP traffic and would work with the same `OTEL_EXPORTER_OTLP_ENDPOINT` env var — just point it at the SigNoz OTel Collector endpoint instead (typically `http://signoz-otel-collector:4318`).

The application telemetry client is fully collector-agnostic. Any OTLP-compatible backend works.

