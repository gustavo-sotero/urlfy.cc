# Elysia Best-Practice Alignment Plan (Extremely Detailed)

## Context & Scope

This plan targets alignment with ElysiaJS official best practices (controllers as Elysia instances, request-dependent services as plugins, model reuse via validation schemas, minimal context passing, handler-level testing). Scope covers:

- API routing modules in src/server/api/\*\*
- API entrypoint in src/app/api/[[...slugs]]/route.ts
- Shared types in src/types/** and schema definitions in src/db/schema/**
- Tests in tests/\*\* (integration + helpers)

Out of scope: UI components and Next.js App Router pages unless they directly invoke Elysia handlers.

## Phase 0 — Baseline Inventory & Mapping

### 0.1 Enumerate Elysia Entrypoints & Controllers

- Locate all Elysia instances:
  - Search for `new Elysia` and `.group`, `.use`, `.get`, `.post`, `.patch`, `.delete` in src/server/api and src/server/middleware.
- Build a list of controller modules:
  - Each file that exports an Elysia instance (e.g., `export const ... = new Elysia()` or `export default new Elysia()`), treat as a controller.
- Map routing composition:
  - Identify where controllers are composed into the API gateway (`src/app/api/[[...slugs]]/route.ts`) and any `src/server/api/index.ts` or similar router aggregator.

Deliverable:

- Controller inventory table (file path → Elysia instance name → prefix/base path).

### 0.2 Inventory Validation Schemas

- Identify where TypeBox/TypeScript validation schemas are defined:
  - Inline route schemas using `t.Object`, `t.String`, `t.Optional`, etc.
  - External schemas in src/types/** or src/server/api/**.
- Categorize by domain:
  - links, auth, users, analytics, admin, health, security.

Deliverable:

- Schema inventory table (schema name → file path → routes using it → whether inline or shared).

### 0.3 Inventory Request-Dependent Services & Decorators

- Locate Elysia plugins and `decorate` usage:
  - Search for `.decorate(` and `.derive(` and `.use(`.
- Tag plugins by purpose:
  - auth/session, rate limiting, metrics, db/redis injection, request context.

Deliverable:

- Plugin inventory table (plugin name → purpose → request-dependent? → used in controllers).

## Phase 1 — Model Reuse & Injection Strategy

### 1.1 Define Shared Model Registry

Goal: Eliminate inline duplication of validation schemas; centralize per domain.

- For each domain (links, users, analytics, admin, health), create a `models.ts` file in `src/server/api/v1/<domain>/models.ts` or `src/types/<domain>.models.ts`.
- Standardize naming:
  - `LinkCreateBody`, `LinkUpdateBody`, `UserProfileResponse`, `AnalyticsQueryParams`, etc.
- Use Elysia `t.*` schemas as the single source of truth.
- Export `typeof <schema>.static` types for TypeScript consumers.

Decision point (structure):

- Option A: feature-based `models.ts` co-located with controllers.
- Option B: centralized `src/types/models/**`.
- Option C: hybrid (shared core in src/types + feature-specific in controller folders).

Deliverables:

- Shared model registry design document.
- Refactored schemas (no functional changes).

### 1.2 Apply Model Injection (Optional, Elysia Best Practice)

- In each controller Elysia instance:
  - Use `new Elysia().model({ ... })` or `app.model({ ... })` to inject named schemas.
- Use named models in route definitions:
  - `body: 'LinkCreateBody'`, `params: 'LinkParams'`, `query: 'AnalyticsQuery'`.
- Benefits:
  - Better OpenAPI generation, inference caching, reuse across routes.

Deliverables:

- Controller updates using model injection.
- OpenAPI verification (if swagger plugin is used).

## Phase 2 — Controller & Service Boundaries

### 2.1 Enforce Controller as Elysia Instance

- Ensure each controller is exported as an Elysia instance.
- If any business logic is inside handlers, move pure logic to service functions.

### 2.2 Split Request-Dependent vs Non-Dependent Services

- Non-request-dependent logic:
  - Move to `src/server/services/<domain>.service.ts` as pure functions or static class.
- Request-dependent logic:
  - Keep as Elysia plugins to preserve inference and access to `Context` only when needed.
- Avoid passing full `Context` into services; pass only required fields:
  - Example: pass `{ userId, requestId }` or `{ headers, ip }` explicitly.

Deliverables:

- Service refactors with explicit inputs.
- Updated controllers using `.use(requestPlugin)` and pure service functions.

## Phase 3 — Testing Strategy with Elysia.handle()

### 3.1 Introduce Handler-Level Tests

- Add tests in `tests/integration` or `tests/helpers` that call Elysia app via `app.handle()`:
  - Build Request objects with method, headers, body.
  - Validate status codes, JSON response shape, and error codes.
- Ensure coverage for:
  - Auth-required endpoints.
  - Validation errors (bad body/params).
  - Typical success paths.

### 3.2 Test Harness & Utilities

- Create helper to run Elysia app requests:
  - `createElysiaTestClient(app)` returning helpers to send requests.
- Use deterministic IDs and database fixtures where necessary.

Deliverables:

- New test utility module.
- Test cases for core controllers.

## Phase 4 — API Gateway Consistency

### 4.1 Ensure Central Composition

- Validate the API gateway composes controllers in a consistent order.
- Ensure global plugins (e.g., CORS, auth, rate limiting, tracing) are attached at the gateway.
- Avoid per-controller duplicates of common middleware unless feature-specific.

Deliverables:

- Gateway composition map.
- Updated ordering or consolidation of shared middleware if inconsistent.

## Phase 5 — Observability & Validation Hygiene

### 5.1 Correlation IDs & Structured Logging

- Ensure request IDs are present and passed consistently in Elysia context.
- Make validation error logs consistent with error responses.

### 5.2 Validation Error Contracts

- Ensure `VALIDATION_ERROR` responses share a consistent shape across controllers.

Deliverables:

- Consistent error contracts.
- Test coverage for error payloads.

## Phase 6 — Performance & Edge Considerations

### 6.1 Avoid Excessive Decorators

- Prefer `.derive` or explicit context params instead of `decorate` unless necessary.
- Keep decorated values minimal and request-scoped when required.

### 6.2 Edge Runtime Constraints

- Verify any controller intended for Edge uses compatible APIs.
- Ensure no Node-only dependencies are used in Edge paths.

Deliverables:

- Edge compatibility checklist.
- Documented constraints per controller.

## Acceptance Criteria

- All validation schemas are centralized or injected; no duplicated inline bodies for identical request shapes.
- Controllers export only Elysia instances; services separated by request dependency.
- No service receives full `Context` unless strictly required.
- Tests use `app.handle()` for critical endpoints with both success and error cases.
- API gateway composes all controllers with consistent shared middleware order.

## Risks & Mitigations

- Risk: Large refactor introduces regression.
  - Mitigation: Incremental refactor per domain, tests before/after, feature flags if needed.
- Risk: Schema changes affect OpenAPI or client types.
  - Mitigation: Keep schema shapes unchanged; update only location/usage.

## Detailed Execution Checklist (Per Domain)

1. Identify routes in controller file.
2. Extract schemas to domain models file.
3. Introduce model injection in controller.
4. Update route definitions to use named models.
5. Separate request-dependent logic to plugin or handlers.
6. Add `app.handle()` tests for each route.
7. Validate lint and test suites.

## Tooling & Commands (for later execution)

- Lint: `bun lint`
- Tests: `bun test tests/integration`
- DB migrations (only if schema changes): `bun run db:generate`, `bun run db:migrate`

## Outputs (Expected Files Modified/Added)

- src/server/api/v1/\*\*/models.ts (new)
- src/server/services/\*_/_.ts (new/updated)
- tests/helpers/elysia-test-client.ts (new)
- tests/integration/\*_/_.test.ts (updated)
- src/app/api/[[...slugs]]/route.ts (updated if needed)
