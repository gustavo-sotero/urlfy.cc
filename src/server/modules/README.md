# Server Modules

## Purpose

Feature-based backend modules implementing domain logic and HTTP controllers for the Elysia API.

## Structure

- Each module typically includes:
  - `*.controller.ts`: Elysia controller instance (1 instance = 1 controller)
  - `*.service.ts`: Pure business logic (no HTTP concerns)
  - `*.schema.ts`: TypeBox schemas (single source of truth)
  - `services/`: Focused sub-services for complex modules

## Patterns Used

- Elysia controller pattern with inline context destructuring
- Service pattern using static or exported functions
- TypeBox schemas registered via `.model()` for OpenAPI

## Dependency Boundary Model

Modules may import from two categories of shared code:

### Shared Infrastructure (allowed cross-module imports)
These services provide cross-cutting infrastructure concerns and are intentionally shared:

| Service | Purpose | Location |
|---------|---------|----------|
| `cache.service` | Redis cache operations (get/set/invalidate) | `src/server/services/` |
| `audit.service` | Audit log recording | `src/server/services/` |
| `metrics.service` | Request/performance metrics tracking | `src/server/services/` |
| `email.service` | Transactional email sending | `src/server/services/` |
| `sanitizer.service` | Input sanitization (DOMPurify) | `src/server/services/` |

### Domain Services (module-owned)
Domain-specific logic should live inside the owning module's `services/` directory or `*.service.ts` file:

| Domain | Owner Module | Examples |
|--------|-------------|----------|
| Link creation/update/delete | `links/` | `create-link.ts`, `update-link.ts` |
| URL validation | `links/` (consumes `url-validator` util) | — |
| Short code generation | `links/` (consumes `shortcode.service`) | — |
| QR code generation | `links/` (consumes `qr.service`) | — |
| Redirect resolution | Shared (`redirect.service`) | Used by `/r/[code]` route handler |
| User agent parsing | Shared (`useragent.service`) | Used by analytics worker |
| GDPR data operations | `users/` (consumes `gdpr.service`) | — |
| Anti-abuse detection | Shared (`anti-abuse.service`) | Used by multiple modules |

### Rules
1. **Modules must not import from other modules' internal services** — only from their barrel `index.ts` exports or shared infrastructure services.
2. **Shared infrastructure services** (`src/server/services/`) should be stateless utilities with narrow interfaces.
3. **Domain logic migration**: When shared services contain domain-specific logic that belongs to a single module, prefer extracting it into the owning module over time.

## Adding New Files

1. Create a new module folder if needed.
2. Define schemas first (`*.schema.ts`).
3. Implement services with pure business logic (`*.service.ts`).
4. Add controller routes with explicit destructuring.
5. Export from `index.ts` if the module exposes public controllers.
