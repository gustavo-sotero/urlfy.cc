# Runtime Reliability Hardening Plan

## Scope

This document captures a detailed technical plan to stabilize the runtime failure modes observed in the current `urlfy.cc` stack without starting implementation. The scope covers three related problem clusters:

1. Redis disconnects and cascading request-path failures in `web`, `api`, and `worker`
2. `POST /api/links` returning `500` under degraded conditions when it should remain domain-safe
3. Worker-side data deletion scheduling and stream-processing defects that are independent from, but operationally adjacent to, the Redis incident

This is a production-grade remediation plan. It assumes:

- Infrastructure may be external and managed
- Runtime behavior must be correct under partial dependency outages
- Bun version pinning or upgrade is acceptable if technically justified
- No code changes are performed as part of this document

## Incident Signals

Observed logs indicate multiple failures happening in a short sequence:

- `Redis connection closed with error`
- `Failed to track request metric`
- `Failed to check IP block status`
- `Rate limiter Redis error`
- `GET /api/auth/get-session 200 ... render: 11.3s`
- `POST /api/links 500`
- `[Scheduler] Running data deletion check`
- `[Scheduler] Error in data deletion job`

These signals should not be treated as one single bug. The current evidence points to at least three distinct failure domains that can overlap in time:

- Shared Redis client fragility under disconnect/reconnect conditions
- Domain-layer correctness gap in create-link behavior when Redis-backed idempotency degrades
- Worker pipeline contract drift and deletion-flow correctness defects

## Architectural Context

Relevant runtime architecture from the current repository state:

- `apps/web` is the public Next.js entrypoint and API gateway for `/api/*`
- `apps/api` is the standalone Elysia service mounted behind the web gateway
- `apps/worker` processes Redis Streams and scheduled jobs
- `packages/cache` owns the shared Bun Redis client and Redis Streams utilities
- `packages/data` owns Bun SQL + Drizzle database access

The current request and job topology means the same infrastructure incident can manifest differently across processes:

- Web process: metrics, anti-abuse, gateway rate-limit, redirect analytics enqueue
- API process: health/readiness, idempotency, admin/contact limits, some side effects
- Worker process: stream consumers, queue publishing, metrics aggregation, scheduler jobs

Each process has its own process-local singleton instance, but all point to the same external Redis service. A single managed Redis incident can therefore produce similar symptoms in all three processes without any one process directly closing the others.

## Root Problem Clusters

### Cluster A: Redis Client Reliability and Failure Cascades

Primary file:

- [packages/cache/src/client.ts](packages/cache/src/client.ts)

Current client configuration captures several risk factors in one place:

- Long-lived shared singleton
- Concurrent request-path usage
- `autoReconnect: true`
- `enableAutoPipelining: true`
- `enableOfflineQueue: true`
- No explicit reconnect state machine owned by the application
- No bounded degraded mode for callers beyond scattered local catches

Why this is risky:

- Multiple live request concerns in `apps/web` hit the same client in the same request path
- Bun Redis reconnect behavior has known recent failure reports involving in-flight queue corruption during reconnect
- Offline queue semantics can hide broken connectivity while requests keep accumulating latency and side effects
- Metrics, anti-abuse, and rate limiting are each handling Redis errors locally, but not under a shared process-level degradation contract

Observed cascade path in `apps/web`:

1. `MetricsService.trackRequest()` attempts a Redis write
2. `antiAbuseMiddleware()` checks blocked-IP status against Redis
3. `rateLimit()` performs Redis-backed sliding window checks
4. The same closed or degraded client produces multiple logs in one request

This means the current logs are not evidence of three unrelated failures. They are consistent with one request walking through three Redis-backed services that all share a compromised client.

### Cluster B: `POST /api/links` Correctness Under Redis Degradation

Primary files:

- [apps/web/src/app/api/[[...slugs]]/route.ts](apps/web/src/app/api/[[...slugs]]/route.ts)
- [apps/api/src/server/modules/links/links-protected.controller.ts](apps/api/src/server/modules/links/links-protected.controller.ts)
- [apps/api/src/server/lib/idempotency.ts](apps/api/src/server/lib/idempotency.ts)
- [apps/api/src/server/modules/links/services/create-link.ts](apps/api/src/server/modules/links/services/create-link.ts)

Important current behavior:

- Web-side metrics is fail-open
- Web-side anti-abuse blocked-IP check is fail-open
- Web-side rate limiting for `POST /api/links` is not fail-closed and falls back to in-memory limits
- API-side optional auth degrades to guest behavior when session lookup fails
- API-side idempotency degrades open when Redis is unavailable
- Post-create anti-abuse side effects are best-effort

Conclusion:

Plain Redis unavailability alone should not normally produce a `500` on `POST /api/links` in the current design.

The likely correctness risks are elsewhere:

- Create-link correctness currently depends on read-before-write validation that can race under concurrent submissions
- Redis idempotency failure can permit multiple concurrent submissions to pass through as if no coordination existed
- Database uniqueness constraints may then surface as unhandled persistence errors rather than mapped domain conflicts
- If Bun Redis reconnect semantics return mismatched responses after reconnect, Redis-backed coordination behavior can become logically unsafe instead of merely unavailable

This cluster therefore needs hardening at the domain boundary, not just better infrastructure retries.

### Cluster C: Worker Data Deletion Pipeline Defects

Primary files:

- [apps/worker/src/jobs/scheduler.ts](apps/worker/src/jobs/scheduler.ts)
- [apps/worker/src/server/lib/queue.ts](apps/worker/src/server/lib/queue.ts)
- [packages/cache/src/stream.ts](packages/cache/src/stream.ts)
- [apps/worker/src/workers/deletion-stream.worker.ts](apps/worker/src/workers/deletion-stream.worker.ts)

There are two separate layers of failure here.

Immediate scheduler signal:

- The observed `Error in data deletion job` appears to come from the outer catch around the DB query phase in the scheduler
- This strongly suggests first-touch or runtime DB failure in the worker process before enqueueing

Independent downstream correctness defects already identified:

- Local queue constants diverge from shared stream constants
- Published payload shape diverges from worker-consumed payload shape
- Deletion worker references stale auth table names
- Completion and final audit behavior appear to happen after deleting the user row that later logic still depends on

This means the worker pipeline is currently not trustworthy even if infrastructure comes back healthy.

## Repository Files Requiring Attention

### Redis and Request-Path Reliability

- [packages/cache/src/client.ts](packages/cache/src/client.ts)
- [packages/cache/src/stream.ts](packages/cache/src/stream.ts)
- [apps/web/src/server/services/metrics.service.ts](apps/web/src/server/services/metrics.service.ts)
- [apps/web/src/server/services/anti-abuse.service.ts](apps/web/src/server/services/anti-abuse.service.ts)
- [apps/web/src/server/lib/rate-limiter.ts](apps/web/src/server/lib/rate-limiter.ts)
- [apps/web/src/server/middleware/anti-abuse.ts](apps/web/src/server/middleware/anti-abuse.ts)
- [apps/web/src/server/middleware/rate-limit.ts](apps/web/src/server/middleware/rate-limit.ts)
- [apps/web/src/app/api/[[...slugs]]/route.ts](apps/web/src/app/api/[[...slugs]]/route.ts)

### Create-Link Correctness

- [apps/api/src/server/modules/links/links-protected.controller.ts](apps/api/src/server/modules/links/links-protected.controller.ts)
- [apps/api/src/server/lib/idempotency.ts](apps/api/src/server/lib/idempotency.ts)
- [apps/api/src/server/modules/links/services/create-link.ts](apps/api/src/server/modules/links/services/create-link.ts)
- [apps/api/src/server/modules/links/services/shortcode.service.ts](apps/api/src/server/modules/links/services/shortcode.service.ts)
- [apps/api/src/server/modules/links/services/url-validator.ts](apps/api/src/server/modules/links/services/url-validator.ts)
- [apps/api/src/server/index.ts](apps/api/src/server/index.ts)

### Worker and Data Deletion

- [apps/worker/src/index.ts](apps/worker/src/index.ts)
- [apps/worker/src/jobs/scheduler.ts](apps/worker/src/jobs/scheduler.ts)
- [apps/worker/src/server/lib/queue.ts](apps/worker/src/server/lib/queue.ts)
- [apps/worker/src/workers/deletion-stream.worker.ts](apps/worker/src/workers/deletion-stream.worker.ts)
- [apps/worker/src/workers/cleanup-stream.worker.ts](apps/worker/src/workers/cleanup-stream.worker.ts)
- [apps/worker/src/workers/aggregation-stream.worker.ts](apps/worker/src/workers/aggregation-stream.worker.ts)
- [apps/worker/src/server/services/audit.service.ts](apps/worker/src/server/services/audit.service.ts)

### Runtime Configuration and Operability

- [apps/api/src/lib/env.ts](apps/api/src/lib/env.ts)
- [apps/web/src/lib/env.ts](apps/web/src/lib/env.ts)
- [apps/worker/src/lib/env.ts](apps/worker/src/lib/env.ts)
- [apps/api/src/server/modules/internal/health.controller.ts](apps/api/src/server/modules/internal/health.controller.ts)
- [docker/docker-compose.apps.yml](docker/docker-compose.apps.yml)
- [docker/docker-compose.prod.yml](docker/docker-compose.prod.yml)
- [.env.example](.env.example)
- [package.json](package.json)
- [apps/api/package.json](apps/api/package.json)
- [apps/web/package.json](apps/web/package.json)
- [apps/worker/package.json](apps/worker/package.json)

## Plan of Action

### Phase 1: Establish Dependency Truth Before Code Changes

Goal:

- Determine whether the active failure is purely external, purely code-level, or mixed

Tasks:

1. Confirm the effective Bun runtime version in the actual deployment and local dev environment.
2. Compare that runtime with the currently known Bun Redis reconnect issues affecting long-lived shared `RedisClient` usage.
3. Verify whether managed Redis is experiencing connection resets, failovers, TLS mismatch, idle timeout enforcement, or network interruptions.
4. Confirm the actual values used for:
	- `REDIS_URL`
	- `DATABASE_URL`
	- `TRUST_PROXY`
	- `API_INTERNAL_URL`
5. Determine whether `GET /api/auth/get-session` slowness is dominated by:
	- middleware round-trip cost
	- Better Auth session lookup behavior
	- downstream DB latency
	- queueing caused by degraded Redis or general event-loop pressure

Expected output of this phase:

- A fact-based statement of whether Redis disconnects are being caused by infrastructure, Bun runtime behavior, or both
- An explicit compatibility decision on Bun version pinning/upgrading for Redis usage

### Phase 2: Redesign the Shared Redis Client Contract

Goal:

- Make Redis failure behavior explicit, bounded, and safe for concurrent server workloads

Design objectives:

- No ambiguous reconnect state
- No hidden dependency on offline queue semantics for correctness-sensitive paths
- No accidental propagation of stale client state across critical request concerns
- Clear telemetry for connect, close, reconnect attempt, reconnect success, and degraded state

Planned changes at design level:

1. Reevaluate `enableAutoPipelining` as a default for the shared singleton.
	- Given the current Bun issue profile, correctness should override throughput for control-plane traffic.
2. Reevaluate `enableOfflineQueue`.
	- This is useful only if queued commands are acceptable for each caller.
	- It is not a safe universal default for rate limiting or idempotency semantics.
3. Add an application-owned client health state abstraction around the Bun client.
	- Track last successful operation
	- Track current connection health
	- Track reconnect backoff state
	- Track consecutive failures
4. Explicitly separate caller classes:
	- best-effort writes: metrics, analytics enqueue
	- security-sensitive reads/writes: rate limiting, anti-abuse blocking, idempotency
	- readiness probes: health controller, worker healthcheck
5. Define fallback policy per caller class instead of per individual catch block.

Non-goals for this phase:

- Replacing the Bun-first architecture without hard evidence that a safe integration is impossible
- Optimizing hot-path performance before correctness is reestablished

Decision gate at end of phase:

- If Bun version + safer options produce reliable behavior, keep Bun Redis
- If not, escalate to a justified client substitution discussion

### Phase 3: Bound Web-Side Degradation in the API Gateway

Goal:

- Prevent one degraded Redis client from turning the gateway into a latency amplifier or noisy failure cascade

Current request path in `web`:

1. Request metrics
2. CORS evaluation
3. Anti-abuse block check
4. Rate limiting
5. Upstream API fetch with 8s timeout

Design hardening tasks:

1. Ensure metrics failures remain strictly non-blocking and low-latency.
2. Ensure anti-abuse Redis failures cannot stall request processing while trying to recover connectivity.
3. Ensure rate limiting degraded mode has:
	- bounded CPU cost
	- bounded memory usage
	- deterministic behavior when Redis is unhealthy
4. Consider process-wide degraded-state short-circuiting.
	- If Redis is known unhealthy, request-path code should not repeatedly rediscover that fact via expensive failing calls.
5. Standardize log severity and sampling.
	- Prevent one Redis outage from flooding logs with per-request repeats.

Operational outcome expected:

- Gateway remains available
- Security-sensitive behavior remains predictable
- Logs become diagnostic instead of noisy

### Phase 4: Make `POST /api/links` Correct Without Redis

Goal:

- Ensure link creation remains logically correct even when Redis coordination is unavailable or unreliable

Design problem:

- Redis-backed idempotency is currently treated as the coordination layer for duplicate POST protection
- When Redis degrades open, correctness falls back to application logic that appears vulnerable to read-before-write races
- Database uniqueness constraints are present, but not clearly translated into stable domain errors in the create-link path

Required design changes:

1. Reclassify Redis idempotency as an optimization layer, not a correctness boundary.
2. Make database invariants the final source of truth for uniqueness.
3. Explicitly map persistence uniqueness violations to domain-safe API errors.
	- Custom alias conflict
	- Short code collision
4. Review create-link flow for double-submit scenarios.
	- concurrent guest requests
	- concurrent authenticated requests
	- repeated submission with the same `Idempotency-Key`
5. Ensure Redis failure cannot produce ambiguous API output states.
	- no silent duplicate creation
	- no generic 500 from a predictable race
	- no retry-unfriendly behavior for clients
6. Verify optional auth degradation does not accidentally change ownership semantics or principal resolution in a way that affects idempotency scope.

Desired end state:

- Redis healthy: fast and efficient idempotent behavior
- Redis unhealthy: still correct, slightly less optimized, but not unsafe

### Phase 5: Separate Worker Bootstrap Reliability from Job Logic

Goal:

- Prevent scheduled jobs from becoming the first place where critical dependency failures are discovered

Observed issue:

- Worker startup validates env and starts runtime loops, but scheduler jobs can become the first DB touchpoint
- That makes failures show up late and in the wrong operational context

Planning tasks:

1. Make worker startup dependency checks explicit for both DB and Redis.
2. Decide startup policy:
	- fail fast when core dependencies are unavailable
	- or start in degraded mode with scheduler disabled and clear logging
3. Ensure the scheduler reports which stage failed:
	- DB query
	- Redis publish
	- job serialization
4. Align healthcheck behavior with runtime reality.
	- A healthy worker should imply its actual critical dependencies are available

Expected result:

- The worker either starts honestly or refuses to start honestly
- Operators do not have to infer bootstrap issues from later cron logs

### Phase 6: Unify Queue and Stream Contracts

Goal:

- Remove divergent definitions of stream names, consumer groups, and payload layout

Current defect pattern:

- Scheduler publishes using app-local queue constants
- Workers consume using shared `@urlfy/cache` stream constants
- Message field shape does not match worker assumptions

Required planning actions:

1. Define one source of truth for:
	- stream name
	- consumer group
	- message field schema
	- retry metadata shape
2. Remove or deprecate local duplicate queue definitions once the shared contract is canonical.
3. Ensure all stream consumers parse the same payload format the publisher emits.
4. Apply the same fix pattern to:
	- deletion stream
	- cleanup stream
	- aggregation stream

This is not a deletion-only cleanup. It is a systemic transport-contract correction.

### Phase 7: Repair Deletion Worker Semantics

Goal:

- Make the deletion workflow consistent with the actual schema and referential constraints

Known defects to address in planning:

1. Replace stale auth table names with current schema table names.
2. Include all auth-related records actually present in the schema.
3. Reconcile worker deletion logic with API-side deletion logic to avoid two drifting implementations.
4. Reorder operations so that status completion and audit logging do not depend on rows that have already been deleted.
5. Review referential actions around:
	- `data_deletion_request`
	- `audit_log`
	- `user`
6. Define the authoritative terminal states for deletion requests.
	- pending
	- processing
	- completed
	- failed
7. Ensure worker crashes or retries cannot leave contradictory deletion-request status.

Desired end state:

- A scheduled deletion request can be created, processed, audited, and finalized without relying on stale schema assumptions or violating referential integrity.

### Phase 8: Align Health, Readiness, and Deployment Signals

Goal:

- Make container/process health reflect actual service readiness

Current mismatch:

- `/api/health` is shallow and always returns ok
- `/api/health/ready` checks DB and Redis
- Some compose/container healthchecks use the shallow path, not the readiness path

Planning tasks:

1. Decide which endpoints are for:
	- liveness
	- readiness
	- diagnostics
2. Align Docker and orchestration checks with those semantics.
3. Ensure web health does not mask API dependency failures behind a shallow proxy hop.
4. Review worker health semantics so container health, startup policy, and scheduler behavior remain consistent.

Outcome expected:

- Healthy means capable of serving intended traffic
- Ready means dependencies required for that traffic are available
- Diagnostic endpoints can remain deeper and more verbose

### Phase 9: Eliminate Environment and Config Drift

Goal:

- Remove silent misconfiguration risks that complicate incident analysis

Known drift candidates:

- `TRUST_PROXY` is optional and appears unset by default in checked config paths
- `.env.example` mixes Docker-internal and app-outside-Docker assumptions
- Bun version constraints are not uniformly pinned across root, workspaces, and CI
- Better Auth dependency and CLI version surfaces should be audited for drift consistency

Planning tasks:

1. Define canonical Bun version policy.
2. Define canonical Better Auth dependency/CLI version policy.
3. Explicitly document and set `TRUST_PROXY` behavior by environment.
4. Ensure local development docs distinguish clearly between:
	- infra-only Docker
	- full app-in-Docker
	- external managed services
5. Review whether worker env schema is over-requiring auth-only secrets that it does not actually use.

This phase is important because silent config drift often looks like random runtime instability.

### Phase 10: Add Failure-Mode Test Coverage

Goal:

- Turn the incident into regression coverage, not tribal knowledge

Test categories to add or strengthen:

1. Shared Redis client tests
	- disconnect while commands are in flight
	- reconnect after server restart
	- disabled pipelining vs enabled pipelining behavior
	- unhealthy client degraded-state behavior
2. Web gateway tests
	- Redis unhealthy during metrics only
	- Redis unhealthy during anti-abuse only
	- Redis unhealthy during rate limiting
	- request remains bounded and non-hanging
3. Create-link tests
	- Redis unavailable during idempotency read
	- Redis unavailable during idempotency lock
	- Redis unavailable during idempotency write-back
	- concurrent custom alias submissions
	- concurrent generated code collisions
	- correct domain error mapping instead of generic 500
4. Worker/scheduler tests
	- DB unavailable before scheduler query
	- Redis unavailable during enqueue
	- correct stream/group usage end to end
	- payload parsing compatibility
5. Deletion workflow tests
	- request creation
	- scheduling
	- stream dispatch
	- worker processing
	- completion state and audit generation
	- retry behavior after partial failure

This phase is mandatory. Without it, the system will regress because too many of the current issues are contract-level rather than syntax-level.

## Risk Register

### Risk 1: Bun Redis Reconnect Bugs Persist After Version Change

Impact:

- Shared client remains unsafe under transient network faults

Mitigation:

- Keep client contract conservative
- Test disconnect/reconnect behavior inside this repository
- Do not rely on optimistic reconnect claims without local verification

### Risk 2: Throughput Drops After Disabling Aggressive Redis Options

Impact:

- Slightly higher latency for some non-hot-path control operations

Mitigation:

- Prioritize correctness for control-plane traffic
- Evaluate throughput after stabilization, not before

### Risk 3: Existing Duplicate-Submission Bugs Become More Visible

Impact:

- More explicit domain conflicts appear after uniqueness errors are mapped correctly

Mitigation:

- Treat that as successful hardening, not regression
- Update clients and tests to expect correct conflict semantics

### Risk 4: Queue Contract Cleanup Breaks Existing Worker Behavior Mid-Migration

Impact:

- Jobs can be published to one contract while workers still read another

Mitigation:

- Make stream/payload changes atomically
- Use one canonical contract source

### Risk 5: Stricter Readiness Checks Surface Hidden Deployment Issues

Impact:

- Containers may stop being reported healthy under conditions previously masked

Mitigation:

- Roll readiness changes together with dependency bootstrap changes
- Communicate expected operational effect clearly

## Verification Criteria

The plan should be considered complete only when the following can be proven:

1. Redis disconnects no longer cause unsafe or ambiguous shared-client behavior.
2. A Redis outage does not cause `POST /api/links` to return a generic 500 for predictable race conditions.
3. The worker scheduler clearly distinguishes DB failure from Redis publish failure.
4. Scheduler, queue publisher, and workers all use the same stream/group/payload contract.
5. Deletion processing uses the current schema correctly and finishes with valid final states.
6. Health/readiness endpoints and container healthchecks reflect actual service capability.
7. `TRUST_PROXY` behavior is explicit and environment-correct.
8. Regression tests exist for the main outage and race scenarios.

## Open Technical Questions

These questions should be resolved during refinement before implementation starts:

1. What exact Bun version is running in production and local development right now?
2. Are managed Redis disconnects caused by provider/network behavior, runtime client behavior, or both?
3. Should security-sensitive Redis concerns share the same singleton/client policy as best-effort metrics concerns?
4. Should the worker fail fast on missing DB/Redis, or is a documented degraded mode required?
5. Is there a need to collapse duplicate queue implementations into `packages/cache`, or is a lighter contract-alignment approach sufficient?
6. Should deletion logic live only in the worker, only in a shared service layer, or continue to exist in both API and worker with stricter coordination?
7. Is the current Better Auth middleware/session pattern acceptable for performance, or should session checks move to a different server-side pattern for critical paths?

## Recommended Execution Order

To reduce blast radius, implementation should later follow this order:

1. Dependency truth and runtime version decision
2. Shared Redis client hardening
3. Web gateway degraded-mode hardening
4. Create-link domain correctness hardening
5. Worker bootstrap reliability
6. Queue/stream contract unification
7. Deletion worker semantic repair
8. Health/readiness alignment
9. Config drift cleanup
10. Failure-mode test expansion

This order intentionally addresses cross-cutting runtime safety first, then user-facing correctness, then worker correctness, then operational polish.

## External References

- Bun Redis reference: https://bun.sh/reference/bun/RedisClient
- Bun Redis reconnect issue: https://github.com/oven-sh/bun/issues/27861
- Bun Redis connect/reconnect reliability issue: https://github.com/oven-sh/bun/issues/18895
- Better Auth session and middleware behavior: `/better-auth/better-auth` Context7 docs for Next integration and session management
