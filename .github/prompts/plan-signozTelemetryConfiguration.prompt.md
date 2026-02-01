# Plan: SigNoz & OpenTelemetry Configuration Fix

## Executive Summary

The SigNoz integration is **architecturally correct** but has a **critical bug** in the OTLP exporter URL construction that prevents telemetry data from being ingested. Additionally, local development requires manual `.env` configuration.

---

## Current State Analysis

### ✅ What's Working

| Component                     | Status     | Notes                                                                   |
| ----------------------------- | ---------- | ----------------------------------------------------------------------- |
| `instrumentation.ts`          | ✅ Correct | Properly calls `@/server/init` on Node.js runtime                       |
| `src/server/init.ts`          | ✅ Correct | Initializes telemetry via `initTelemetry()`                             |
| `src/lib/env.ts`              | ✅ Correct | Zod schema validates `TELEMETRY_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `docker-compose.signoz.yml`   | ⚠️ Partial | Correct env injection, but network name may mismatch                    |
| `src/server/lib/telemetry.ts` | ❌ Bug     | Wrong OTLP endpoint paths (missing `/v1/` prefix)                       |

### ❌ Critical Bug: OTLP URL Path

**Location:** `src/server/lib/telemetry.ts` (lines 89-99)

**Current (Broken):**

```typescript
const traceExporter = new OTLPTraceExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/traces` // ❌ Missing /v1/
});

const metricExporter = new OTLPMetricExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/metrics` // ❌ Missing /v1/
});

const logExporter = new OTLPLogExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/logs` // ❌ Missing /v1/
});
```

**Problem:** The OTLP/HTTP specification requires the `/v1/` prefix for all signal types:

- Traces: `/v1/traces`
- Metrics: `/v1/metrics`
- Logs: `/v1/logs`

Without this prefix, the SigNoz collector returns `404 Not Found` and **no telemetry data is ingested**.

---

## Implementation Tasks

### Task 1: Fix OTLP Exporter URLs

**File:** `src/server/lib/telemetry.ts`

**Action:** Update the exporter URL construction to include the `/v1/` prefix.

**Corrected Code:**

```typescript
// ═══════════════════════════════════════════════════════════════════
// EXPORTERS (OTLP/HTTP Protocol - requires /v1/ prefix)
// @see https://opentelemetry.io/docs/specs/otlp/#otlphttp
// ═══════════════════════════════════════════════════════════════════

const traceExporter = new OTLPTraceExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
});

const metricExporter = new OTLPMetricExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
});

const logExporter = new OTLPLogExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
});
```

**Type Safety Note:** The `OTLPTraceExporter`, `OTLPMetricExporter`, and `OTLPLogExporter` classes from `@opentelemetry/exporter-*-otlp-http` packages accept a `url` property of type `string`. Ensure the `env.OTEL_EXPORTER_OTLP_ENDPOINT` is validated as a URL (already done in `env.ts` via `z.url().optional()`).

---

### Task 2: Verify Docker Network Configuration

**File:** `docker/docker-compose.signoz.yml`

**Current Configuration:**

```yaml
networks:
  signoz-net:
    external: true
    name: signoz-net
```

**Potential Issue:** The SigNoz Docker Compose stack (cloned via `bun run signoz:clone`) may create a network with a different name depending on the directory structure. Common names include:

- `docker_default`
- `signoz_default`
- `clickhouse-setup_default`

**Verification Steps:**

```bash
# After running signoz:up, check the actual network name
docker network ls | grep -E "(signoz|clickhouse)"
```

**If Network Name Differs:** Update `docker-compose.signoz.yml`:

```yaml
networks:
  signoz-net:
    external: true
    name: <ACTUAL_NETWORK_NAME> # Replace with output from docker network ls
```

---

### Task 3: Configure Local Development Environment

**File:** `.env` (root directory)

**Required Variables for Local Dev (`bun dev`):**

```ini
# ═══════════════════════════════════════════════════════════════════
# OPENTELEMETRY / SIGNOZ (Local Development)
# ═══════════════════════════════════════════════════════════════════
# Enable telemetry export
TELEMETRY_ENABLED=true

# SigNoz collector endpoint (localhost because port 4318 is exposed by SigNoz docker)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service identification
OTEL_SERVICE_NAME=urlfy-api-local

# Optional: Enable debug logging for connection issues
# OTEL_DEBUG=true
```

**Why `localhost:4318`?**

- When running `bun dev` locally (not in Docker), the app runs on the host machine.
- The SigNoz collector exposes port `4318` (OTLP/HTTP) to the host.
- Therefore, the endpoint must be `http://localhost:4318`.

**Docker Environment (Already Configured):**
The `docker-compose.signoz.yml` already injects:

```yaml
- OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
```

This uses the internal Docker DNS name, which is correct for container-to-container communication.

---

### Task 4: Startup Sequence

**Prerequisites:**

1. Docker Desktop running with at least 4GB RAM allocated
2. SigNoz cloned to `../signoz` (relative to project root)

**Step-by-Step:**

```bash
# 1. Clone SigNoz (one-time setup)
bun run signoz:clone

# 2. Start SigNoz stack
bun run signoz:up

# 3. Wait for SigNoz to be healthy (~60 seconds)
# Verify at http://localhost:3301 (SigNoz UI)

# 4. Verify network name
docker network ls | grep signoz
# Expected output includes the network name to use in docker-compose.signoz.yml

# 5. Start urlfy with observability
bun run docker:up:signoz

# 6. Verify telemetry is flowing
# Open SigNoz UI → Services → urlfy-api should appear
```

**For Local Development (without Docker for the app):**

```bash
# 1. Ensure SigNoz is running
bun run signoz:up

# 2. Ensure .env has TELEMETRY_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# 3. Start the app
bun dev
```

---

## Validation Checklist

After implementing the fixes, verify:

- [ ] **Trace Export:** Make a request to `/api/health`. Check SigNoz UI → Traces → Filter by `urlfy-api`.
- [ ] **Metric Export:** After ~60 seconds, check SigNoz UI → Metrics → Service `urlfy-api`.
- [ ] **Log Export:** Check SigNoz UI → Logs → Filter by `service.name = urlfy-api`.
- [ ] **No 404 Errors:** In app logs, no `ECONNREFUSED` or `404` errors from OTEL exporters.

---

## Code Quality Guidelines

### Type Safety

The `getEnv()` function returns a typed `Env` object. Always destructure or access properties directly:

```typescript
// ✅ Good: Type-safe access
const env = getEnv();
if (env.TELEMETRY_ENABLED && env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Initialize with confidence
}

// ❌ Bad: Bypassing type system
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT; // string | undefined
```

### URL Construction

When constructing URLs, prefer template literals with clear path segments:

```typescript
// ✅ Good: Clear, readable
const url = `${baseEndpoint}/v1/traces`;

// ❌ Bad: String concatenation, error-prone
const url = baseEndpoint + '/v1' + '/traces';
```

### Error Handling

The current `initTelemetry()` function handles missing config gracefully. Maintain this pattern:

```typescript
export function initTelemetry(): void {
  const env = getEnv();

  if (!env.TELEMETRY_ENABLED) {
    console.log('[Telemetry] Disabled (TELEMETRY_ENABLED=false)');
    return;
  }

  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.warn(
      '[Telemetry] Enabled but OTEL_EXPORTER_OTLP_ENDPOINT not set. Skipping initialization.'
    );
    return;
  }

  // Proceed with initialization...
}
```

---

## Files to Modify

| File                               | Action                                                                  | Priority               |
| ---------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| `src/server/lib/telemetry.ts`      | Fix `/v1/` prefix in exporter URLs                                      | 🔴 Critical            |
| `.env`                             | Add `TELEMETRY_ENABLED` and `OTEL_EXPORTER_OTLP_ENDPOINT` for local dev | 🟡 Required for local  |
| `docker/docker-compose.signoz.yml` | Verify/update `signoz-net` network name                                 | 🟡 Required for Docker |

---

## References

- [OTLP/HTTP Specification](https://opentelemetry.io/docs/specs/otlp/#otlphttp)
- [SigNoz Docker Installation](https://signoz.io/docs/install/docker/)
- [OpenTelemetry Node.js SDK](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/)
