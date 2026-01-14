# BullMQ Edge Runtime Fix

## Problem

```
TypeError: undefined is not an object (evaluating 'process.version.charCodeAt')
  at module evaluation (src/server/lib/queue.ts:1:1)
  at module evaluation (src/server/middleware/redirect.middleware.ts:5:1)
  at module evaluation (src/middleware.ts:5:1)
```

**Root Cause:** Next.js middleware runs on **Edge Runtime** by default, which doesn't have access to full Node.js APIs. BullMQ requires Node.js APIs like `process`, `child_process`, and native Redis drivers that aren't available in Edge runtime.

## Solution Architecture

Instead of directly importing BullMQ in the middleware, we use an **internal API endpoint** that runs on Node.js runtime:

```
┌─────────────────────────────────────────────────────────┐
│                    Edge Runtime                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  middleware.ts (Edge)                           │   │
│  │    └─> redirect.middleware.ts                   │   │
│  │          └─> fetch /api/internal/analytics      │   │
│  │               (non-blocking, fire-and-forget)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTP POST
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Node.js Runtime                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  /api/internal/analytics/route.ts               │   │
│  │    export const runtime = "nodejs"              │   │
│  │    └─> analyticsQueue.add(event)                │   │
│  │          └─> BullMQ → Redis                     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Changes Made

### 1. Created Internal API Endpoint

**File:** `src/app/api/internal/analytics/route.ts`

- Forces Node.js runtime with `export const runtime = "nodejs"`
- Accepts click events via POST
- Uses BullMQ to enqueue events (works in Node.js)
- Protected with `x-internal-token` header (uses `BETTER_AUTH_SECRET`)

### 2. Updated Redirect Middleware

**File:** `src/server/middleware/redirect.middleware.ts`

- **Removed:** `import { analyticsQueue } from "@/server/lib/queue"`
- **Changed:** `enqueueClickEvent()` now uses `fetch()` to call internal API
- Uses **fire-and-forget** pattern (doesn't block redirect)
- Catches errors silently to prevent redirect failures

### 3. Security

Internal API protected with token validation:

- Middleware sends: `x-internal-token: <BETTER_AUTH_SECRET>`
- API validates token before accepting events
- Returns 403 if token invalid/missing

## Benefits

✅ **Edge Runtime Compatible:** Middleware no longer imports Node.js-specific code  
✅ **Non-Blocking:** Analytics dispatch doesn't slow down redirects  
✅ **Resilient:** Redirect succeeds even if analytics fails  
✅ **Secure:** Internal API protected with shared secret  
✅ **Scalable:** Can deploy to Vercel Edge, Cloudflare Workers, etc.

## Testing

```bash
# Start dev server
bun dev

# Should start without "process.version.charCodeAt" error
# Note: Redis connection errors are expected if Redis not running
```

## Production Considerations

1. **Redis must be running** for BullMQ workers
2. Consider using Docker Compose for local development:
   ```bash
   docker-compose -f docker/docker-compose.dev.yml up -d redis
   ```
3. Set `REDIS_HOST` and `REDIS_PORT` in `.env` if not using defaults

## Alternative Approaches Considered

1. **Run middleware in Node.js runtime:** Not possible - Next.js middleware must run on Edge
2. **Use Edge-compatible queue:** Would require major refactor and lose BullMQ features
3. **Direct database writes:** Would skip retry logic and Dead Letter Queue
4. **Event streaming:** Overkill for this use case

## Related Documentation

- [Next.js Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [BullMQ Requirements](https://docs.bullmq.io/)
- [Architecture: Caching Strategy](../architecture/caching-strategy.md)
