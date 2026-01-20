# Technical Plan: Refactor to Feature-Based Modular Architecture

## Objective

Migrate the `urlfy.cc` backend from a technical layered architecture (split by `api/`, `services/`, `models/`) to a domain-driven feature-based modular architecture (`modules/{feature}/`). This aligns with ElysiaJS best practices for scalability and cohesion.

## 1. Target Directory Structure

```
src/server/
├── modules/
│   ├── links/
│   │   ├── links.controller.ts   # (Formerly api/links/index.ts)
│   │   ├── links.service.ts      # (Formerly services/link.service.ts)
│   │   └── links.schema.ts       # (Formerly api/models/links.models.ts)
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.schema.ts
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.schema.ts
│   └── analytics/
│       ├── analytics.controller.ts
│       ├── analytics.service.ts
│       └── analytics.schema.ts
├── common/                       # Shared utilities/dtos
│   └── common.schema.ts
└── api/
    └── v1/
        └── index.ts              # Root API Router
```

## 2. Technical Implementation Steps

### Phase 1: Infrastructure Setup

1.  Create the `src/server/modules` directory.
2.  Create subdirectories: `links`, `auth`, `users`, `analytics`, `common`.

### Phase 2: Links Module Migration (Pilot)

**Target**: `src/server/modules/links/`

1.  **Model Migration (`links.schema.ts`)**:
    - Move `src/server/api/models/links.models.ts` to `src/server/modules/links/links.schema.ts`.
    - Ensure all `t.Object` definitions are exported.
    - **Refactor**: Group exports into a single object for injection if not already done.

    ```typescript
    export const LinkModel = {
      create: LinkCreateBody,
      update: LinkUpdateBody
      // ...
    };
    ```

2.  **Service Migration (`links.service.ts`)**:
    - Move `src/server/services/link.service.ts` to `src/server/modules/links/links.service.ts`.
    - **Refactor**: Convert standalone functions to `static` methods within an `abstract class`.
    - _Rationale_: Prevents instantiation, cleaner import namespaces (`LinkService.create`).

    ```typescript
    export abstract class LinkService {
      static async create(...) { ... }
      static async getByCode(...) { ... }
    }
    ```

3.  **Controller Migration (`links.controller.ts`)**:
    - Move `src/server/api/links/index.ts` to `src/server/modules/links/links.controller.ts`.
    - Update imports to reference local `./links.service` and `./links.schema`.
    - Update `Elysia` instantiation to use the new Model injection pattern.

    ```typescript
    import { LinkService } from './links.service';
    import { LinkModel } from './links.schema';

    export const linksController = new Elysia({ prefix: '/links' })
      .use(LinkModel) // Model Injection
      .post('/', ({ body }) => LinkService.create(body), {
        body: 'link.create' // Type reference from injected model
      });
    ```

### Phase 3: Auth Module Migration

**Target**: `src/server/modules/auth/`

1.  **Model**: Move `src/server/api/models/auth.models.ts` → `src/server/modules/auth/auth.schema.ts`.
2.  **Service**: Move `src/server/services/auth.service.ts` → `src/server/modules/auth/auth.service.ts`.
    - Wrap in `abstract class AuthService`.
3.  **Controller**: Move auth routes from `src/server/api/auth/*` (or existing controller) to `src/server/modules/auth/auth.controller.ts`.

### Phase 4: Users & Analytics Migration

Repeat pattern for `users` and `analytics` modules.

- **Users**: `users.schema.ts`, `users.service.ts`, `users.controller.ts`.
- **Analytics**: `analytics.schema.ts`, `analytics.service.ts`, `analytics.controller.ts`.

### Phase 5: Root Router Update

**File**: `src/server/api/index.ts`

Update the root router to import controllers from their new modular locations.

```typescript
import { linksController } from '@/server/modules/links/links.controller';
import { authController } from '@/server/modules/auth/auth.controller';
// ...

const v1 = new Elysia({ prefix: '' }).use(linksController).use(authController);
// ...
```

### Phase 6: Dead Code Cleanup

1.  Verify no references remain to:
    - `src/server/api/models/`
    - `src/server/services/`
    - `src/server/api/{feature}/` (old controller folders)
2.  Delete these directory trees.

## 3. Best Practice Enforcement

### Service Pattern

- **Rule**: Services MUST NOT import `Context` from Elysia. They should receive pure data arguments.
- **Rule**: Services MUST be `abstract class` with `static` methods for stateless logic.

### Controller Pattern

- **Rule**: Controllers MUST be instantiated as `new Elysia({ prefix: '/name' })`.
- **Rule**: Controllers SHOULD NOT contain business logic; they delegate to Services immediately.
- **Rule**: Use `.model()` to register schemas for OpenAPI type generation.

### Model Pattern

- **Rule**: Models MUST be defined using TypeBox (`t.Object`).
- **Rule**: Models MUST be defined in the `.schema.ts` file of the module.

## 4. Verification Plan

1.  **Run Tests**: Execute `bun test` to ensure no regression in logic.
2.  **Type Check**: Run `tsc --noEmit` to verify all imports are resolved.
3.  **Lint**: Run `bun lint` to check for style consistency.
