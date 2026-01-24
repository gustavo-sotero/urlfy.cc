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

## Solution: Internal API Pattern

We split the redirect flow into two parts:

### 1. Edge Proxy (`src/proxy.ts`)

- Runs in Edge Runtime environment
- Handles route matching and basic HTTP logic
- Makes internal API call to resolve links
- Returns redirect response

### 2. Node.js API Route (`src/app/api/internal/resolve/[code]/route.ts`)

- Runs in full Node.js runtime
- Has access to database, OpenTelemetry, BullMQ
- Uses existing `redirectService` with all features
- Protected by `INTERNAL_API_SECRET` header

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
│  - Call internal API ───────────┐   │
└─────────────────────────────────│───┘
                                  │
                                  ▼
┌─────────────────────────────────────────┐
│  Internal API Route                     │
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

The internal API is protected by:

1. **Secret header**: `x-internal-api: ${INTERNAL_API_SECRET}`
2. **Network isolation**: Not exposed externally in production
3. **Origin check**: Only accepts requests from same origin

In production, consider:

- Using Vercel's internal networking
- Setting up firewall rules to block external access to `/api/internal/*`

## Files

| File                                           | Runtime | Purpose                  |
| ---------------------------------------------- | ------- | ------------------------ |
| `src/proxy.ts`                                 | Edge    | Route matching           |
| `src/server/middleware/redirect.middleware.ts` | Edge    | Redirect logic, API call |
| `src/server/lib/telemetry.edge.ts`             | Edge    | Lightweight logging      |
| `src/app/api/internal/resolve/[code]/route.ts` | Node.js | Link resolution          |
| `src/server/services/redirect.service.ts`      | Node.js | Full redirect service    |
| `src/server/lib/telemetry.ts`                  | Node.js | OpenTelemetry            |

## Performance Considerations

### Latency Impact

Making an internal API call adds ~1-5ms overhead compared to direct database access. This is acceptable because:

- Edge proxy is globally distributed (low latency to users)
- Internal API call is within same region/datacenter
- Total P99 latency still < 300ms (target)

### Caching

The redirect service already has Redis caching, so most requests hit cache and are fast regardless of the API hop.

### Monitoring

Track both:

- Edge proxy latency (includes API call)
- Internal API latency (database + Redis)

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

When testing locally:

```bash
# .env.local
INTERNAL_API_SECRET=dev-secret-key-for-testing
```

In production:

```bash
# Generate secure secret
openssl rand -hex 32

# Set in environment
INTERNAL_API_SECRET=<generated-secret>
```

## References

- [Next.js Middleware Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [Vercel Edge Functions Limitations](https://vercel.com/docs/functions/edge-functions/edge-functions-api#unsupported-apis)
- [PRD Module 4: Redirect Engine](../../docs/modules/module-04-redirect.md)
