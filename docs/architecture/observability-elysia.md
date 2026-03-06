# Elysia OpenTelemetry Integration

> 📖 [← Back to Overview](./overview.md)

**Last Updated:** 2026-03-06

---

## Overview

The urlfy.cc API now uses the official `@elysiajs/opentelemetry` plugin to provide granular observability of the request lifecycle within Elysia handlers.

### Benefits

- **Granular Tracing:** Separate spans for parsing, validation, handlers, transforms, and error handling
- **Named Handlers:** Function names appear in traces (e.g., `createLink`, `listUserLinks`)
- **Better Debugging:** Identify performance bottlenecks at the hook level
- **SSE/Streaming Support:** Built-in support for Server-Sent Events tracing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐                                                 │
│  │  Next.js   │  (Parent Span: POST /api/links)                │
│  │  Middleware│                                                 │
│  └─────┬──────┘                                                 │
│        │                                                        │
│        ▼                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Elysia OpenTelemetry Plugin                     │    │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │    │
│  │  │parse │→ │before│→ │handle│→ │after │→ │trans │     │    │
│  │  │      │  │Handle│  │(named│  │Handle│  │ form │     │    │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘     │    │
│  │                         ▲                               │    │
│  │                         │                               │    │
│  │                   Function Name                         │    │
│  │                   (e.g., createLink)                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Global OpenTelemetry SDK (@urlfy/telemetry)               ││
│  │ Initialized by apps/api/src/server/init.ts                ││
│  │ - OTLP Exporter → SigNoz                                  ││
│  │ - Auto-instrumentations (HTTP, pg, Redis)                 ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Plugin Registration

The plugin is registered as the **first middleware** in the Elysia API router to capture the full request lifecycle:

```typescript
// apps/api/src/server/index.ts
import { opentelemetry } from '@elysiajs/opentelemetry';

export const api = new Elysia({ prefix: '/api' })
  .use(
    opentelemetry({
      // Automatically uses the global SDK initialized in apps/api/src/server/init.ts
    })
  )
  .use(errorMiddleware)
  .use(corsPlugin);
// ...
```

### 2. Service Build Boundary

The API is now built and deployed as a standalone Bun service, so `@elysiajs/opentelemetry` is resolved entirely inside `apps/api` and no longer needs special handling in `apps/web`/Next.js bundling:

```typescript
// apps/api/package.json
{
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun"
  }
}
```

### 3. Named Handlers

Critical handlers are refactored to use named functions for better trace visibility:

```typescript
// ✅ Named function - span will be named "createLink"
.post('/', async function createLink({ body, user, set }) {
  // Handler logic
})

// ❌ Anonymous function - span will be named "anonymous"
.post('/', async ({ body, user, set }) => {
  // Handler logic
})
```

**Refactored Handlers:**

- `createLink` - POST /api/links
- `createBulkLinks` - POST /api/links/bulk
- `listUserLinks` - GET /api/links
- `getLinkById` - GET /api/links/:id
- `updateLink` - PATCH /api/links/:id
- `validateUrl` - POST /api/links/validate
- `verifyLinkPassword` - POST /api/links/by-code/:code/verify-password
- `generateQrCode` - GET /api/links/by-code/:code/qr

---

## Viewing Traces in SigNoz

### 1. Start Infrastructure

Use the local infrastructure plus app services, or point the OTLP exporter at an existing SigNoz deployment:

```bash
bun run docker:up
bun run dev:api
```

### 2. Generate Traces

```bash
# Create a link
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 3. Access SigNoz UI

1. Open `http://localhost:3301`
2. Navigate to **Traces**
3. Filter by `service.name = urlfy-api`
4. Click on a trace to see:
   - Parent span: `POST /api/links` (Next.js)
   - Child spans:
     - `parse` - Request body parsing
     - `beforeHandle` - Middleware execution
     - `createLink` - Handler execution
     - `afterHandle` - Post-processing
     - `transform` - Response transformation

---

## Advanced Usage

### Custom Attributes

Add domain-specific metadata to spans:

```typescript
import { setAttributes } from '@elysiajs/opentelemetry';

.post('/', async function createLink({ body, user }) {
  setAttributes({
    'urlfy.link.url_domain': new URL(body.url).hostname,
    'urlfy.user.id': user?.id ?? 'anonymous',
  });
  // ...
})
```

### Manual Span Creation

Wrap service calls with explicit spans:

```typescript
import { record } from '@elysiajs/opentelemetry';

const link = await record('LinkService.create', async () => {
  return LinkService.create(input, userId);
});
```

---

## Performance Impact

- **Overhead:** < 1ms per request (negligible)
- **Memory:** ~50KB per 1000 spans (buffered before export)
- **Network:** Spans exported in batches to SigNoz

---

## Troubleshooting

### Spans Not Appearing

1. **Check global SDK initialization:**

   ```typescript
  // apps/api/src/server/init.ts should import @urlfy/telemetry BEFORE the API starts listening
   ```

2. **Verify OTLP endpoint:**

   ```bash
   curl http://localhost:4318/v1/traces
   ```

3. **Check SigNoz logs:**
   ```bash
   docker compose -f docker/docker-compose.yml --profile observability logs -f signoz-otel-collector
   ```

### Anonymous Span Names

Ensure handlers are named functions, not arrow functions.

---

## References

- [Elysia OpenTelemetry Plugin](https://elysiajs.com/plugins/opentelemetry.html)
- [Elysia OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)
- [OpenTelemetry JS SDK](https://opentelemetry.io/docs/instrumentation/js/)
- [SigNoz Documentation](https://signoz.io/docs/)

---

**Implementation Date:** 2026-01-31  
**Status:** ✅ Production Ready
