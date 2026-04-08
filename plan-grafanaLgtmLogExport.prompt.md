# Plan: Resolve Missing OTLP Log Export to Self-Hosted Grafana LGTM

## Status
Planning only. Do not implement anything until this plan is reviewed and approved.

## Objective
Identify and fix the root cause of the current production behavior where the application successfully exports metrics and traces to the self-hosted Grafana LGTM collector, but application logs do not appear in the backend.

The final solution must:
- preserve the current working traces and metrics pipeline
- fix log export at the root cause, not by adding workaround collectors or console scraping
- remain robust under Docker and production runtime conditions
- improve diagnosability if logs fail again in the future
- keep the telemetry package as the canonical observability entrypoint for the monorepo

## Production Context
Known collector topology:

- Collector stack is self-hosted and based on `grafana/otel-lgtm:latest`
- Production collector base URL is `https://collector.urlfy.cc/`
- Current LGTM compose is effectively:

```yaml
services:
  lgtm:
    image: grafana/otel-lgtm:latest
    volumes:
      - lgtm-data:/data
    environment:
      - ENABLE_LOGS_ALL=true
    networks:
      - dokploy-network
    ports:
      - "3000"
      - "4318"
networks:
  dokploy-network:
    external: true
volumes:
  lgtm-data:
```

Important operational note from upstream `grafana/docker-otel-lgtm` documentation:
- `ENABLE_LOGS_ALL=true` enables internal component logging for Grafana/Loki/Tempo/OTel Collector troubleshooting
- it does not enable or disable application OTLP log ingestion
- application logs are still expected to arrive via standard OpenTelemetry OTLP ingestion

## Verified Facts Already Established
The following facts have already been validated and should be treated as hard evidence while refining the implementation plan.

### 1. The current source-level telemetry pipeline can emit OTLP logs
`packages/telemetry/src/init.ts` was executed against a local mock OTLP HTTP server. The actual package code emitted:
- `POST /v1/logs`
- `POST /v1/metrics`

This proves the current code path is capable of producing OTLP log requests in at least one environment.

### 2. Module-scope loggers are not the immediate failure
A logger created before `configureLogging()` was still able to emit successfully after configuration. This means the widespread pattern in the codebase of:

```ts
const logger = createLogger('module-name');
```

at module scope is not, by itself, the explanation for why production logs are missing.

### 3. The emitted OTLP logs payload is structurally valid
Captured OTLP logs payload contained:
- resource attributes including `service.name`, `service.version`, and `deployment.environment`
- standard log records under `resourceLogs -> scopeLogs -> logRecords`
- expected log body and attributes

This means the immediate payload shape is not obviously malformed.

### 4. The manual test that worked did not use the full application path
The successful manual validation was a direct HTTP POST to the logs endpoint, not a proof that the full runtime path used by the application is correct under Docker, dependency resolution, TLS, reverse proxying, and production collector settings.

### 5. The repo currently contains multiple OpenTelemetry version families
The dependency graph currently includes multiple installed OpenTelemetry families, including but not limited to:
- `@opentelemetry/sdk-node@0.200.0`
- `@opentelemetry/sdk-node@0.211.0`
- `@opentelemetry/sdk-node@0.213.0`
- `@opentelemetry/sdk-logs@0.200.0`
- `@opentelemetry/sdk-logs@0.208.0`
- `@opentelemetry/sdk-logs@0.211.0`
- `@opentelemetry/sdk-logs@0.213.0`
- matching version splits for `@opentelemetry/exporter-logs-otlp-http`

This is a serious production-risk area, especially for logs, which are the least mature OTel signal and most sensitive to runtime skew.

## Current Architecture Surfaces Involved
Primary source files and configuration surfaces that matter for this issue:

### Telemetry core
- `packages/telemetry/src/init.ts`
- `packages/telemetry/src/logger.ts`
- `packages/telemetry/src/index.ts`
- `packages/telemetry/package.json`

### Runtime bootstraps
- `apps/api/src/server/init.ts`
- `apps/web/src/server/init.ts`
- `apps/web/instrumentation.ts`
- `apps/worker/src/index.ts`

### Dependency/config surfaces
- `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `bun.lock`

### Docker/runtime surfaces
- `docker/api.Dockerfile`
- `docker/web.Dockerfile`
- `docker/worker.Dockerfile`
- `docker/docker-compose.prod.yml`
- `.env.example`

### Validation/docs
- `scripts/validate-opentelemetry.ts`
- `docs/architecture/signoz-setup.md`
- `docs/architecture/overview.md`
- `docs/architecture/observability-elysia.md`

## Constraints
Any eventual implementation must respect the following constraints:
- no fallback to log scraping from stdout as the primary fix
- no out-of-band one-off log sender bypassing the shared telemetry package
- no breaking of the current working traces and metrics export path
- no broad refactor of unrelated application logging APIs
- no dependence on development-only console sinks in production
- no assumption that the collector normalizes malformed URLs or duplicate path separators
- no dependence on undocumented behavior of `grafana/otel-lgtm`

## Non-Goals
The following are explicitly out of scope for the remediation:
- redesigning the entire observability architecture
- replacing LogTape with another logging library
- migrating the monorepo away from the current shared telemetry package
- rebuilding the LGTM stack into a full production Alloy deployment unless collector limitations make that mandatory later
- changing unrelated request logging semantics in API/web/worker modules

## Primary Root-Cause Hypotheses
These are the hypotheses that remain credible after the local proof-of-life tests.

### Hypothesis A: Production-only dependency/runtime skew is breaking log export
This is currently the highest-confidence root-cause candidate.

Why this is plausible:
- the workspace contains multiple `sdk-node`, `sdk-logs`, and OTLP exporter families simultaneously
- `apps/api` also depends on `@elysiajs/opentelemetry`, which pulls its own `sdk-node` family
- traces and metrics can appear healthy even when logs are silently broken because logs rely on separate runtime/provider integration
- the local source test exercises the current workspace resolution, but not necessarily the final Docker/container/runtime combination used in production

Specific skew points to investigate:
- `package.json` root dependency versions versus `packages/telemetry/package.json`
- `@elysiajs/opentelemetry` transitive OTel dependencies
- whether the final API/Web/Worker Docker images resolve different versions than the interactive local shell session
- whether `@logtape/otel` and the custom `LoggerProvider` are interacting with a different `sdk-logs` family than the exporter instance

Target outcome:
- one coherent OpenTelemetry runtime family for the application-level telemetry stack
- one coherent LogTape family across root and workspace packages

### Hypothesis B: OTLP endpoint construction is too fragile for production collector routing
This is currently the second most credible hypothesis.

Why this is plausible:
- production base endpoint ends with a trailing slash: `https://collector.urlfy.cc/`
- `packages/telemetry/src/init.ts` currently appends `/v1/logs`, `/v1/metrics`, and `/v1/traces` directly
- this can create double-slash paths like `https://collector.urlfy.cc//v1/logs`
- some reverse proxies normalize this, some do not, and behavior may differ by path, upstream, or TLS termination rules
- direct manual POST success does not prove the application is building the exact same URL, headers, and transport configuration

Sub-issues that should be treated as part of the same hypothesis:
- lack of support for `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`
- lack of support for `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- lack of support for `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- missing or incomplete support for `OTEL_EXPORTER_OTLP_HEADERS`
- missing or incomplete support for per-signal headers
- missing or incomplete support for OTLP protocol envs when relevant

Target outcome:
- deterministic and spec-aligned signal endpoint resolution
- no accidental double slashes or duplicated suffixes
- optional per-signal override support for logs if collector routing needs separation later

### Hypothesis C: Collector/ingress parity is different between manual curl and application exporter traffic
This is the third highest-confidence hypothesis.

Why this is plausible:
- the app uses the OTLP HTTP exporter path and exporter runtime semantics
- the manual test used a raw HTTP request path that may not match exporter defaults exactly
- the production URL is fronted by HTTPS and likely a reverse proxy or ingress layer
- reverse proxy behavior may differ for content type, request body size, duplicate slashes, HTTP/1.1 keep-alive, or upstream path forwarding

Collector-side or ingress-side items to validate later:
- exact reverse proxy rule forwarding `https://collector.urlfy.cc/*` to the LGTM OTLP HTTP receiver
- whether `/v1/logs` reaches the internal collector intact
- whether the proxy strips or rewrites path prefixes inconsistently
- whether the proxy allows large JSON OTLP log bodies
- whether TLS termination or auth middleware differs between logs and the manual test
- whether Loki inside `otel-lgtm` is receiving OTLP logs but they are being indexed differently than expected in Grafana

Target outcome:
- production collector path proven equivalent to the app exporter path
- one validated end-to-end smoke test that reproduces the exact runtime path used in production

### Hypothesis D: Telemetry exporter failures are happening silently
This is not necessarily the original root cause, but it is definitely a design gap.

Why this matters:
- current bootstrap logs confirm initialization, but not successful sustained export of logs
- exporter flush failures are largely best-effort
- production incidents become harder to diagnose when logs fail but metrics/traces still succeed

Target outcome:
- failure surfaces that remain non-fatal but provide enough signal to identify exporter issues without attaching a debugger

## Strategic Direction
The remediation should not start by changing runtime behavior blindly. It should proceed through a controlled sequence that preserves known-good behavior while shrinking the production-only uncertainty envelope.

The plan is split into five workstreams:
1. dependency/runtime unification
2. OTLP endpoint and env contract hardening
3. telemetry self-diagnostics hardening
4. automated regression coverage
5. operational/documentation parity cleanup

## Workstream 1: Dependency and Runtime Unification
Goal: ensure logs, metrics, and traces all run on a single coherent OpenTelemetry family wherever the shared telemetry package executes.

### Tasks
1. Inventory every direct and transitive OpenTelemetry package used by:
   - `package.json`
   - `packages/telemetry/package.json`
   - `apps/api/package.json`
   - `apps/web/package.json`
   - `apps/worker/package.json`
2. Identify which version family should become canonical.
   - initial likely target: align `packages/telemetry` upward to the root family rather than keeping mixed `0.211.x` and `0.213.x`
   - verify whether `@logtape/otel` current installed version remains compatible with the chosen `sdk-logs` family
3. Investigate `@elysiajs/opentelemetry` compatibility.
   - determine whether a newer plugin version exists that aligns with the chosen OTel family
   - if not, decide whether API tracing plugin isolation is acceptable or whether the plugin must be pinned and isolated from the shared logs pipeline
4. Remove version drift where possible.
   - shared telemetry package should not intentionally pull an older OTel family than the workspace root
   - root and package-local `@logtape/*` versions should match
5. Re-run dependency tree checks after alignment.
   - `bun why @opentelemetry/sdk-node`
   - `bun why @opentelemetry/sdk-logs`
   - `bun why @opentelemetry/exporter-logs-otlp-http`
   - `bun why @logtape/logtape`
   - `bun why @logtape/otel`

### Acceptance Criteria
- the shared telemetry runtime resolves a single intended `sdk-logs` family
- the shared telemetry runtime resolves a single intended OTLP logs exporter family
- LogTape core and LogTape OTel sink resolve to one coherent version family
- no accidental split remains between the provider class and the exporter class actually used by the shared telemetry package

### Risks
- API tracing plugin may lag behind the latest shared OTel family
- Web standalone build may package a different subset than expected from the dev shell
- Bun workspace resolution may hide differences that only appear in Docker build stages

## Workstream 2: OTLP Endpoint and Env Contract Hardening
Goal: make the OTLP configuration deterministic, spec-aligned, and production-safe.

### Problems to solve
- base endpoint with trailing slash should not generate malformed paths
- per-signal endpoint overrides should be supported explicitly
- headers should be configurable in a standard way
- service version should not depend solely on `npm_package_version` if runtime packaging strips it or makes it misleading

### Design requirements
1. Introduce explicit signal endpoint resolution in `packages/telemetry/src/init.ts`.
2. Treat env inputs in the following order of precedence:
   - per-signal endpoint env (if present) is used as-is
   - otherwise, derive signal endpoint from normalized base endpoint
3. Normalize base endpoints safely.
   - trim whitespace
   - remove trailing slashes before appending signal suffixes
   - preserve scheme and authority correctly
   - avoid converting `https://` into malformed output when collapsing slashes
4. Support standard OTLP envs where applicable:
   - `OTEL_EXPORTER_OTLP_ENDPOINT`
   - `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`
   - `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
   - `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
   - `OTEL_EXPORTER_OTLP_HEADERS`
   - signal-specific headers if supported by the chosen exporter API
   - protocol envs if they materially affect the exporter path selection
5. Preserve backward compatibility for current deployments that only set the base endpoint.

### Additional contract improvements
- evaluate whether `OTEL_SERVICE_VERSION` should override `npm_package_version` when present
- decide whether telemetry should warn loudly when the base endpoint already includes `/v1/...` and a suffix append would duplicate it
- document exactly what form the endpoint should take in `.env.example`

### Acceptance Criteria
- `https://collector.urlfy.cc/` resolves to `https://collector.urlfy.cc/v1/logs`, not `//v1/logs`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` can point directly at a full URL without suffix rewriting
- metrics and traces continue to resolve correctly from the same configuration path
- no hidden behavior depends on proxy normalization of malformed URLs

## Workstream 3: Telemetry Self-Diagnostics Hardening
Goal: make future log export failures observable without crashing the app.

### Diagnostic gaps to address
- successful init does not prove successful export
- exporter flush failures are currently easy to miss
- there is no explicit startup probe log that confirms the full LogTape-to-OTLP path under the app runtime

### Design requirements
1. Add bounded diagnostics around log export setup.
   - when telemetry is active, record the resolved logs/metrics/traces endpoints once during bootstrap
   - log whether headers are configured, without printing secrets
2. Improve exporter failure visibility.
   - if `forceFlush()` fails during bootstrap or shutdown, write a bootstrap-level error to stderr/stdout in a structured way
   - keep behavior best-effort and non-fatal
3. Emit a single post-config pipeline probe log after `configureLogging()` when telemetry is active.
   - this probe should be low-volume and safe in production
   - it should help distinguish “pipeline initialized” from “no app log records were ever emitted"
4. Consider temporary or optional OTel diagnostics gating.
   - keep the existing `OTEL_DEBUG` guard approach
   - do not flood production logs with OTel internal noise

### Acceptance Criteria
- when logs export fails, operators get an explicit bootstrap-level signal
- logs exporter diagnostics do not crash API/web/worker startup
- diagnostics are low-noise and production-safe

## Workstream 4: Automated Regression Coverage
Goal: convert the currently manual proofs into automated guardrails.

### Required new tests
#### A. OTLP mock integration test for logs export
Add a test around the shared telemetry package that:
- boots a mock HTTP server locally
- sets `TELEMETRY_ENABLED=true`
- points OTLP envs to the mock server
- initializes the real shared telemetry package
- emits at least one LogTape log through `createLogger()`
- asserts that `/v1/logs` was called
- asserts that the payload contains `service.name`

#### B. Pre-configured logger regression test
Add a test that creates a logger before `configureLogging()` and emits after configuration.
This should remain covered because the codebase relies heavily on module-scope logger instantiation.

#### C. Trailing-slash base endpoint regression test
Add a test that sets:
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318/`

and proves the resulting requests target:
- `/v1/logs`
- `/v1/metrics`
- `/v1/traces`

without malformed double-slash path generation.

#### D. Per-signal endpoint regression test
Add a test that sets:
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=<custom full URL>`

and proves the logs exporter uses that endpoint without auto-appending an extra suffix.

#### E. Dependency skew guardrail
Extend `scripts/validate-opentelemetry.ts` to fail when the shared telemetry path resolves incompatible or multiple unexpected OTel families for logs.

### Suggested test location
Primary candidate:
- new tests near `packages/telemetry/src/__tests__/`

### Acceptance Criteria
- the shared telemetry package has at least one end-to-end export regression test
- the test suite proves the current issue class cannot silently regress
- the validator script becomes a meaningful preflight check rather than a presence-only checklist

## Workstream 5: Docker, Operations, and Documentation Parity
Goal: remove stale observability assumptions and align the repo with the actual deployment topology.

### Problems to correct
- the repo still contains SigNoz-oriented docs and wording despite the current production direction being self-hosted LGTM
- `.env.example` and compose comments do not fully capture the actual collector contract
- operators could easily misread `ENABLE_LOGS_ALL` as the switch controlling app log ingestion

### Tasks
1. Update `.env.example`.
   - document the endpoint as an OTLP collector base URL
   - show correct examples without implying SigNoz-only usage
   - document per-signal endpoint envs
   - document headers envs if supported
   - clarify service name and service version inputs
2. Update `docker/docker-compose.prod.yml` comments.
   - remove SigNoz-specific wording where the actual requirement is just “OTLP collector”
   - clarify that the value should point to the collector HTTP base endpoint
3. Replace or rewrite `docs/architecture/signoz-setup.md`.
   - either rename it to a collector-agnostic LGTM/OTLP doc or clearly mark it as historical/stale
   - include the current self-hosted LGTM stack assumptions
   - explain that `grafana/otel-lgtm` is a bundled LGTM backend with an OTel Collector receiver
   - explicitly note that `ENABLE_LOGS_ALL` is not an application-ingestion feature flag
4. Ensure `docs/architecture/overview.md` and `docs/architecture/observability-elysia.md` match the actual runtime behavior.

### Acceptance Criteria
- docs describe the same collector model actually used in production
- env examples do not encourage malformed endpoint configuration
- future operators can distinguish collector internal logs from application OTLP logs

## Detailed Validation Plan
Validation must happen at multiple levels. Local shell proof is not enough.

### Phase 1: Workspace-level validation
Purpose: prove the shared telemetry package logic is correct in the repository runtime.

Checks:
- export to a mock OTLP HTTP server from the real `packages/telemetry` package
- verify log payload shape
- verify endpoint normalization
- verify pre-configured loggers still emit
- verify traces/metrics remain intact

### Phase 2: Docker image validation
Purpose: catch resolution or packaging drift between the local shell and container runtime.

Checks:
- build API, web, and worker images from the current Dockerfiles
- run each against a mock OTLP HTTP server accessible from the container network
- verify that each runtime emits logs to `/v1/logs`
- compare actual installed package versions inside containers against the intended aligned dependency family

### Phase 3: Collector-path validation
Purpose: prove that the application exporter path matches what the real collector and proxy expect.

Checks:
- run the app against the actual collector or a production-like staging collector
- use a temporary dedicated `OTEL_SERVICE_NAME` to isolate test traffic
- generate deterministic log events from API, web, and worker runtimes
- confirm the records appear in Grafana logs for the expected service within a bounded time window
- confirm the same service still produces metrics and traces

### Phase 4: Incident-proofing validation
Purpose: ensure the next failure becomes diagnosable quickly.

Checks:
- intentionally point logs to a broken endpoint while leaving metrics/traces configuration valid in a test scenario if possible
- confirm bootstrap diagnostics surface the logs export failure clearly
- ensure the app remains up if resilience policy requires it

## Risks and Tradeoffs
### 1. Aligning versions may force broader dependency upgrades
This is acceptable if done surgically and validated across API/web/worker. Logs are not the place to tolerate hidden runtime splits.

### 2. `@elysiajs/opentelemetry` may lag behind the chosen OTel family
If the plugin cannot be aligned cleanly, the plan should explicitly decide whether:
- to pin the entire app to the plugin’s family temporarily
- or to isolate the API tracing plugin from the shared logging provider path

This decision must be made consciously, not accidentally through lockfile drift.

### 3. Production collector may still need configuration beyond the app fix
If the collector or reverse proxy path is the real blocker, the app-side fixes above are still worth doing because they remove ambiguity and harden the client contract.

### 4. `grafana/otel-lgtm` is not a production-grade architecture by default
Upstream positions it as development/demo/testing oriented. That alone does not explain the current incident, but it matters for long-term reliability expectations.

## Explicitly Rejected Approaches
These approaches should not be used as the primary fix:
- scraping stdout or Docker logs into Loki instead of fixing OTLP app logs
- adding a second logging stack in parallel just for logs
- bypassing the shared telemetry package with custom curl-based log emitters
- using one-off per-app logging code instead of hardening the shared package
- relying on the reverse proxy to normalize broken OTLP paths

## Deliverables Expected from the Eventual Implementation
The eventual implementation, when approved, should produce the following artifacts:
- updated shared telemetry initialization logic in `packages/telemetry/src/init.ts`
- aligned observability dependency versions in manifests and lockfile
- improved validator logic in `scripts/validate-opentelemetry.ts`
- automated OTLP logs export regression tests under `packages/telemetry/src/__tests__/`
- updated env and operations docs reflecting LGTM-based deployment reality
- evidence from Docker/runtime validation, not just local shell execution

## Minimum Acceptance Criteria for Sign-Off
The remediation should not be considered complete unless all of the following are true:
- API, web, and worker all emit logs to the collector through the shared telemetry path
- logs appear in the self-hosted Grafana LGTM backend for a dedicated test service name
- traces and metrics still work after the fix
- no malformed OTLP endpoint construction remains
- the dependency graph no longer contains unexpected split families for the shared logging path
- automated tests exist for OTLP logs export and endpoint normalization
- docs and env examples match the real collector topology

## Open Questions for Refinement Before Implementation
These questions should be answered during refinement or the earliest implementation spike:
1. Which exact reverse proxy or ingress sits in front of `https://collector.urlfy.cc/`?
2. Does the proxy forward `/v1/logs` unchanged to the collector’s OTLP HTTP receiver on `4318`?
3. Are there any auth, WAF, or body-size rules on the collector domain that differ from the direct manual curl test?
4. Which exact version of `grafana/otel-lgtm` is running in production?
5. Is the collector using default config, or is a custom `otelcol-config.yaml` mounted?
6. Does the production setup expose Grafana Explore/Logs in a way that may hide logs due to labels or resource-attribute mapping rather than ingest failure?
7. Can `@elysiajs/opentelemetry` be aligned to the target OpenTelemetry family cleanly, or is plugin isolation needed?

## References Used for This Plan
External references that informed the plan:
- LogTape quick start: `https://logtape.org/manual/start`
- LogTape OpenTelemetry sink docs: `https://logtape.org/sinks/otel`
- `@logtape/otel` docs: `https://jsr.io/@logtape/otel/doc`
- OpenTelemetry JS logs setup examples and NodeSDK docs
- Grafana Cloud OTLP docs
- Grafana Loki OTLP ingestion docs
- `grafana/docker-otel-lgtm` README and configuration notes

## Refinement Guidance
When refining this plan further, preserve the following priority order:
1. eliminate runtime/version ambiguity
2. harden endpoint/env semantics
3. add diagnostics and tests
4. update docs to match real operations

Do not refine it into a shortcut solution that only makes logs appear temporarily while leaving version skew and endpoint fragility unresolved.