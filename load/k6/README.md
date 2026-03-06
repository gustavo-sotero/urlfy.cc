# k6 Load Harness

This directory contains manual load-testing harnesses for the monorepo split.

Current scripts:

- `redirect-hot-path.js`: validates the `apps/web` redirect path without introducing an extra `web -> api` hop.

## Prerequisites

- Install `k6`, or set `K6_BIN` to the executable path.
- Start the local stack with `bun run docker:up`, `bun run dev:api`, `bun run dev:web`, and `bun run dev:worker` when needed.
- Seed a known redirect code before running the test.

## Redirect Hot Path

Example:

```bash
BASE_URL=http://localhost:3000 SHORT_CODE=mycode EXPECTED_LOCATION_PREFIX=https://example.com bun run test:load
```

Supported environment variables:

- `BASE_URL`: public URL for `apps/web`
- `SHORT_CODE`: existing short code to resolve
- `EXPECTED_STATUS`: redirect status, defaults to `302`
- `EXPECTED_LOCATION_PREFIX`: prefix for the redirect target, defaults to `https://`
- `SLEEP_MS`: pause between iterations, defaults to `200`

The script emits custom metrics:

- `urlfy_redirect_latency`
- `urlfy_redirect_success_rate`
- `urlfy_redirect_cache_hit_rate`
- `urlfy_redirect_unexpected_status_total`