# Redirect Performance Baseline

This document records the baseline validation procedure for the monorepo redirect hot path after the `web/api/worker` split.

## Scope

Measure the synchronous redirect path served by `apps/web` and backed by `@urlfy/redirect-domain`, `@urlfy/cache`, and `@urlfy/data`.

Targets:

- Redirect latency P50: `< 30ms`
- Redirect latency P99: `< 300ms`
- Redirect error rate: `< 1%` during load validation
- Cache hit rate: `> 70%` during warm-cache load validation

## Preconditions

1. Start infrastructure with `bun run docker:up`.
2. Start services with `bun run dev` or the production-equivalent stack.
3. Seed or create at least one known redirect code.
4. Warm the cache with a few manual requests before collecting the warm-cache baseline.

## Baseline Commands

Fast local perf suites:

```bash
bun run test:perf
```

Manual redirect load harness:

```bash
BASE_URL=http://localhost:3000 SHORT_CODE=mycode EXPECTED_LOCATION_PREFIX=https://example.com bun run test:load
```

## Regression Checklist

- `bun run lint`
- `bun run type-check`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:security`
- `bun run test:perf`
- `bun run test:load` against a known code

## Evidence to Capture

- k6 output with `http_req_duration` P95/P99 and failure rate
- `urlfy_redirect_cache_hit_rate` from the k6 script
- sample redirect response headers: `X-Request-Id`, `X-Redirect-Depth`, `X-Cache-Status`
- any SigNoz charts used during validation (`urlfy.redirect.latency`, cache hit rate, error rate)

## Notes

- `bun run test:load` uses `scripts/run-k6.ts`, which expects a local `k6` binary or `K6_BIN` env override.
- This baseline is intended to validate the split architecture and does not replace broader production load testing.