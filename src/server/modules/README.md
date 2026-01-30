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

## Adding New Files

1. Create a new module folder if needed.
2. Define schemas first (`*.schema.ts`).
3. Implement services with pure business logic (`*.service.ts`).
4. Add controller routes with explicit destructuring.
5. Export from `index.ts` if the module exposes public controllers.
