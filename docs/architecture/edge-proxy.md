# Edge Proxy Architecture - urlfy.cc

> 📖 [← Voltar ao Overview](./overview.md)

## Context

Next.js middleware runs in a **restricted environment**, which is a limited JavaScript runtime that doesn't include all Node.js APIs. This limits what libraries can be used.

## Problem

The original design had the redirect middleware directly accessing:

- Database via Bun SQL (`import { SQL } from "bun"`)
- OpenTelemetry with Node.js instrumentations
- Redis Streams for analytics queue

None of these work in the Middleware environment, causing errors like:

```
The runtime does not support Node.js 'os' module.
Failed to load external module bun: TypeError: Native module not found: bun
```

## Solution: Edge Rewrite + Node Route Handler

The redirect flow is split into two runtime-safe parts:

### 1. Edge Proxy (`apps/web/src/proxy.ts`)

- Runs in Edge Runtime environment
- Handles route matching and basic HTTP logic
- Rewrites short-code requests to Node route handler (`/r/:code`)

### 2. Node.js Route Handler (`apps/web/src/app/r/[code]/route.ts`)

- Runs in full Node.js runtime
- Has access to database, OpenTelemetry and Redis Streams
- Uses `@urlfy/redirect-domain` with the same business rules
- Executes redirect decision directly (no internal HTTP hop)

## Flow

```
User Request
    │
    ▼
┌─────────────────────────────────────┐
│  Edge Proxy                         │
│  (Fast, Global, Limited APIs)       │
│  - Check redirect depth             │
│  - Check password cookie            │
│  - Rewrite to /r/:code ────────┐    │
└─────────────────────────────────│───┘
                                  │
                                  ▼
┌─────────────────────────────────────────┐
│  Node Route Handler (/r/:code)          │
│  (Node.js Runtime, Full Features)       │
│  - Database access                      │
│  - Redis cache                          │
│  - OpenTelemetry tracing                │
│  - Redis Streams analytics queue        │
│  - Circuit breakers                     │
└─────────────────────────────────────────┘
                                  │
                                  ▼
                          Redirect Response
```

## Security

The redirect route handler keeps the same validation guarantees without an
internal API endpoint:

1. Redirect depth control (`X-Redirect-Depth`, max 3)
2. IP/per-link rate limiting
3. Password-unlock cookie verification before resolving protected links

## Files

| File                                      | Runtime | Purpose                        |
| ----------------------------------------- | ------- | ------------------------------ |
| `apps/web/src/proxy.ts`                   | Edge    | Route matching                 |
| `apps/web/src/app/r/[code]/route.ts`      | Node.js | Redirect resolution + response |
| `packages/redirect-domain/src/service.ts` | Bun/TS  | Redirect domain rules          |
| `packages/telemetry/src/index.ts`         | Bun/TS  | OpenTelemetry helpers          |

## Performance Considerations

### Latency Impact

The `/r/:code` handler removes one internal network hop from the hot path,
reducing latency and failure surface while preserving redirect semantics.

### Caching

The redirect service already has Redis caching, so most requests hit cache and are fast regardless of the API hop.

### Monitoring

Track both:

- Edge proxy latency (rewrite path)
- Redirect handler latency (`/r/:code`, database + Redis)

This helps identify bottlenecks.

## Alternative Considered: Vercel Edge Config

Vercel Edge Config stores key-value data globally and is accessible from Middleware. However:

**Not chosen because:**

- Only 512KB storage limit (insufficient for all links)
- Max 1KB per key (insufficient for link metadata)
- Additional cost and vendor lock-in
- Requires sync jobs to populate from PostgreSQL

**Our approach is better:**

- Works on any platform (not just Vercel)
- No storage limits
- Single source of truth (PostgreSQL)
- Full feature access in API route

## Testing

Validate redirect flow with integration tests targeting `/r/:code` and
redirect-service resolution matrix.

## References

- [Next.js Middleware Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [Vercel Edge Functions Limitations](https://vercel.com/docs/functions/edge-functions/edge-functions-api#unsupported-apis)
- [PRD Module 4: Redirect Engine](../../docs/modules/module-04-redirect.md)
