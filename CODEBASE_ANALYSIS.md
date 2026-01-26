# CODEBASE_ANALYSIS.md

## Executive Summary

Overall codebase health: **7.6/10**.

Strengths:

- Clear modular backend architecture (Elysia controllers + services + models).
- Good security hygiene in input sanitization and URL validation.
- Solid redirect hot path with cache-aside, negative caching, and circuit breaker.
- Observability foundations with OpenTelemetry and structured logging.

Critical/High-Risk Issues:

1. **JWT secret fallback to a hardcoded default** (risk of predictable tokens). See [src/server/config/plugins.ts](src/server/config/plugins.ts#L21).
2. **API key hashing inconsistency + plaintext key lookup** (auth bypass or unusable hashed keys; exposure risk if DB leaks). See [src/server/modules/api-keys/api-keys.service.ts](src/server/modules/api-keys/api-keys.service.ts#L26), [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L407), [src/server/middleware/api-key.guard.ts](src/server/middleware/api-key.guard.ts#L134).
3. **Rate limiting IP fallback to 127.0.0.1** when proxy trust is disabled (all clients share one bucket). See [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L27-L32).
4. **Sensitive header logging** (cookies and authorization headers logged in debug). See [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L111-L112) and [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L60).

---

## Detailed Findings

### 1. Structure and Organization

**Current state:**

- Clean separation between frontend (src/app) and backend (src/server).
- Backend organized into modules (src/server/modules), middleware, services, and lib utilities.
- Documentation is extensive and aligned with PRD and architecture docs.

**Issues/risks:**

- **Parallel routing structures**: both src/server/api and src/server/modules exist. This can lead to drift, duplicated logic, and unclear routing conventions. The comments suggest a legacy path. Recommendation: consolidate to modules or explicitly mark legacy APIs for deprecation.
  - Reference: [src/server/api](src/server/api) and [src/server/modules](src/server/modules)

**Recommendations:**

- Define a single API source-of-truth (prefer modules) and plan a migration for legacy endpoints.
- Add a doc note describing the transitional boundary (or enforce via lint rules to prevent new endpoints in legacy folders).

---

### 2. Code Consistency

**Observations:**

- Naming conventions are mostly consistent and Elysia patterns are properly applied.
- Some cross-cutting concerns (auth, API keys, rate limiting) are implemented in multiple styles or locations.

**Issues/risks:**

- **API key hashing mismatch**: API keys are generated with `Bun.hash` in the service, while authentication uses SHA-256 via `crypto.subtle.digest`. This can cause authentication failures or security inconsistencies.
  - Generation: [src/server/modules/api-keys/api-keys.service.ts](src/server/modules/api-keys/api-keys.service.ts#L26)
  - Verification: [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L407)
- **Plaintext API key lookup** exists in `api-key.guard.ts`, while hashed lookup exists elsewhere. Storing and querying plaintext keys in DB is a security risk.
  - [src/server/middleware/api-key.guard.ts](src/server/middleware/api-key.guard.ts#L134)
- **Mixed logging patterns**: `console.warn` is used in server utilities instead of the structured logger.
  - [src/server/lib/idempotency.ts](src/server/lib/idempotency.ts#L15-L32)

**Recommendations:**

- Standardize API key hashing: use a single cryptographic hash (e.g., SHA-256) for both storage and lookup, and drop plaintext storage.
- Replace console logging in server utilities with the structured logger for consistency and log correlation.

---

### 3. Best Practices Compliance

**Observations:**

- Services are mostly pure business logic.
- Middleware follows Elysia best practices (context destructuring, scoped derives).
- Strong validation pipeline for URLs and metadata.

**Issues/risks:**

- **Hardcoded JWT secret fallback** in `jwtPlugin` enables predictable tokens if env variables are missing.
  - [src/server/config/plugins.ts](src/server/config/plugins.ts#L21)
- **Security headers duplicated** across Elysia middleware and Next.js headers. This can lead to drift or inconsistent CSP updates.
  - [src/server/middleware/security-headers.ts](src/server/middleware/security-headers.ts#L15-L28)
  - [next.config.ts](next.config.ts#L9-L17)

**Recommendations:**

- Require `JWT_SECRET` or `BETTER_AUTH_SECRET` and fail fast in production if missing.
- Keep security headers in one place (or generate Next.js headers from the Elysia config to avoid mismatch).

---

### 4. Clean Code Analysis

**Observations:**

- Controllers are readable and delegate to services.
- Sanitization utilities are well-structured with clear limits and whitelists.
  - [src/server/lib/sanitize.ts](src/server/lib/sanitize.ts)

**Issues/risks:**

- **Sensitive header logging**: cookies and authorization headers are logged in debug statements. This can leak session tokens in logs.
  - [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L111-L112)
  - [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L60)
- **Deprecated macro**: `api-key.macro.ts` is unused and may confuse contributors.
  - [src/server/middleware/api-key.macro.ts](src/server/middleware/api-key.macro.ts)

**Recommendations:**

- Remove or mask sensitive header values in logs (log only boolean presence or short hashes).
- Move deprecated macro to docs or delete if not needed to avoid confusion.

---

### 5. Performance and Efficiency Review

**Observations:**

- Redirect engine uses cache-aside, negative caching, and distributed locks.
  - [src/server/services/redirect.service.ts](src/server/services/redirect.service.ts)
- Cache invalidation avoids `KEYS` via `SCAN` (good for scale).
  - [src/server/services/cache.service.ts](src/server/services/cache.service.ts)

**Issues/risks:**

- **Rate limiting IP fallback** defaults to `127.0.0.1` if `TRUST_PROXY` is not enabled, causing all traffic to share a single limiter bucket.
  - [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L27-L32)
- **Redis sequential ops** in the rate limiter may cause higher latency at scale. Bun has auto-pipelining, but the code explicitly avoids pipeline support (comment indicates no pipeline support). This may be okay now but could become a bottleneck.
  - [src/server/lib/rate-limiter.ts](src/server/lib/rate-limiter.ts)

**Recommendations:**

- Enforce correct `TRUST_PROXY` configuration in production and add a startup warning if missing.
- Consider a Lua script or pipelining for rate limiting to reduce round trips if throughput grows.

---

### 6. Security Audit

**High severity:**

1. **Hardcoded JWT secret fallback** allows predictable token generation in misconfigured environments.
   - [src/server/config/plugins.ts](src/server/config/plugins.ts#L21)
2. **Plaintext API key storage/lookup** increases exposure risk if DB is compromised.
   - [src/server/middleware/api-key.guard.ts](src/server/middleware/api-key.guard.ts#L134)
3. **API key hashing inconsistency** can break auth or create brittle verification.
   - [src/server/modules/api-keys/api-keys.service.ts](src/server/modules/api-keys/api-keys.service.ts#L26)
   - [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L407)

**Medium severity:**

- **Sensitive header logging** risks leaking session tokens to logs.
  - [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L111-L112)
  - [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L60)
- **CSP permits `unsafe-inline` and `unsafe-eval`**. This is sometimes needed for Swagger/Next.js but should be restricted to dev or to specific routes.
  - [src/server/middleware/security-headers.ts](src/server/middleware/security-headers.ts#L15-L16)
  - [next.config.ts](next.config.ts#L9-L10)

**Low severity:**

- Console logging in production code may bypass structured logging. Consider consistent logger usage.
  - [src/server/lib/idempotency.ts](src/server/lib/idempotency.ts#L15-L32)

**Recommendations:**

- Remove the default JWT secret and enforce required env configuration.
- Store only hashed API keys; remove plaintext fields or ensure they are never used for lookup.
- Mask sensitive data in logs (cookies, authorization headers).
- Tighten CSP in production and allow `unsafe-*` only for specific routes if needed (Swagger UI).

---

## Actionable Recommendations (Prioritized)

**P0 (Immediate):**

1. Remove JWT secret fallback; fail fast if secrets are missing. [src/server/config/plugins.ts](src/server/config/plugins.ts#L21)
2. Unify API key hashing and eliminate plaintext key lookups. [src/server/modules/api-keys/api-keys.service.ts](src/server/modules/api-keys/api-keys.service.ts#L26), [src/server/middleware/api-key.guard.ts](src/server/middleware/api-key.guard.ts#L134)
3. Mask sensitive headers in logs. [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts#L111-L112), [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L60)

**P1 (Near-term):** 4. Enforce `TRUST_PROXY` config or derive IP from trusted headers only; add startup warnings. [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts#L27-L32) 5. Consolidate security header sources to avoid drift. [src/server/middleware/security-headers.ts](src/server/middleware/security-headers.ts#L15-L28), [next.config.ts](next.config.ts#L9-L17)

**P2 (Later):** 6. Reduce sequential Redis commands in rate limiter via Lua or pipelining. [src/server/lib/rate-limiter.ts](src/server/lib/rate-limiter.ts) 7. Remove deprecated api-key macro or move to docs. [src/server/middleware/api-key.macro.ts](src/server/middleware/api-key.macro.ts)

---

## Appendix

### Metrics & Signals

- Redirect path uses cache-aside + circuit breaker, with metrics for cache hits/misses and fallback counters.
  - [src/server/services/redirect.service.ts](src/server/services/redirect.service.ts)
  - [src/server/lib/telemetry.ts](src/server/lib/telemetry.ts)

### Tools & Methodology

- Manual review of core runtime paths (redirect, auth, API keys, rate limiting, caching).
- Pattern searches for security risks, logging, and TODOs.

### Key Files Reviewed

- [src/server/services/redirect.service.ts](src/server/services/redirect.service.ts)
- [src/server/middleware/redirect.middleware.ts](src/server/middleware/redirect.middleware.ts)
- [src/server/middleware/auth.middleware.ts](src/server/middleware/auth.middleware.ts)
- [src/server/middleware/rate-limit.ts](src/server/middleware/rate-limit.ts)
- [src/server/config/plugins.ts](src/server/config/plugins.ts)
- [src/server/modules/api-keys/api-keys.service.ts](src/server/modules/api-keys/api-keys.service.ts)
- [src/server/middleware/api-key.guard.ts](src/server/middleware/api-key.guard.ts)
- [src/server/lib/sanitize.ts](src/server/lib/sanitize.ts)
- [src/server/services/url-validator.ts](src/server/services/url-validator.ts)
- [next.config.ts](next.config.ts)
