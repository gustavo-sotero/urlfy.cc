# Engineering Plan: ElysiaJS Architecture & Best Practices Refactoring

**Goal**: Align the `urlfy.cc` codebase with ElysiaJS best practices to ensure strict type safety, modularity, and maintainability. Focus on removing `Context` leakage in controllers and standardizing the Service/Plugin architecture.

---

## 🔍 Context & Problem Statement

The current implementation occasionally violates strict Elysia patterns, specifically:

1.  **Context Leakage**: Passing the massive `Context` object to Controller handlers instead of destructuring specific properties (e.g., `body`, `user`, `set`). This breaks type inference and makes unit testing difficult.
2.  **Service Ambiguity**: Some "Services" might be handling Request/Response logic (headers, cookies) which should be implemented as **Elysia Plugins/Macros**, while others are pure business logic (DB operations) which should be **Static Abstract Classes**.
3.  **Model Definition**: Ensuring strict `TypeBox` usage and `typeof Model.static` type inference across the board.

---

## 🛠 Phase 1: Controller Refactoring (Context Removal)

**Objective**: Eliminate all usage of strictly typed or loose `Context` objects in Route Handlers.

### 1.1. Audit

- [ ] Scan `src/server/api/**/*.ts` for methods accepting `ctx` or `context`.
- [ ] specifically target `src/server/api/users/me.ts` which has known violations.

### 1.2. Implementation Strategy

Refactor handlers to destructure inputs at the call site.

**Before (Anti-Pattern):**

```typescript
// src/server/api/example.ts
app.post('/', async (ctx) => {
  // ❌ Heavy context passing, unclear dependencies
  return Controller.handle(ctx);
});

abstract class Controller {
  static handle(ctx: Context) {
    const { body, user } = ctx; // Late destructuring
    // ...
  }
}
```

**After (Best Practice):**

```typescript
// src/server/api/example.ts
app.post('/', async ({ body, query, user, set }) => {
  // ✅ Clear dependencies, strictly typed by Elysia inference
  return Controller.create({
    data: body,
    user,
    setDetails: (h) => {
      set.headers = h;
    }
  });
});

abstract class Controller {
  // Service Input is explicit
  static create(input: {
    data: CreateDTO;
    user: UserSession;
    setDetails?: any;
  }) {
    // ...
  }
}
```

### 1.3. Execution Tasks

- [ ] Refactor `src/server/api/users/me.ts` routes (`GET /`, `PATCH /`, etc.).
- [ ] Refactor any other controllers found in `src/server/api/`.

---

## 🔄 Phase 2: Service Architecture Review

**Objective**: Distinguish between "Business Logic" (Service) and "Request Utilities" (Plugin).

### 2.1. Criteria

- **Service (Static Class):**
  - Input: Pure data (DTOs, IDs).
  - Output: Data or Errors.
  - Dependencies: DB, Redis, other Services.
  - _Example_: `LinkService.create(url, userId)`.
- **Plugin (Elysia Plugin/Macro):**
  - Input: `Context` (Cookie, Headers, Request).
  - Output: Derived state (`user`, `geo`) or Side Effects (Setting cookies).
  - _Example_: `Auth.derive(session)`, `GeoIP.derive(ip)`.

### 2.2. Execution Tasks

- [ ] **Review `src/server/services/*`**:
  - Identify services accessing `headers`, `cookies`, or `set`.
  - **Action**: Convert these specific methods/services into Elysia Plugins (`src/server/plugins/`) or Macros.
  - _Candidate_: `cache.service.ts` (if it handles HTTP cache headers directly).
  - _Candidate_: `auth.service.ts` (Likely should remain a Service called by a Plugin).

---

## 📐 Phase 3: Model & Type Standardization

**Objective**: Single Source of Truth for types using TypeBox.

### 3.1. Rules

1.  **No Manual Interfaces**: Do not manually define TypeScript interfaces that duplicate the validation schema.
2.  **Inference**: Use `Static` or `typeof Model.static`.
3.  **Separation**: Models live in `.model.ts` files (or `src/server/modules/*/models.ts`).

### 3.2. Execution Tasks

- [ ] Check `src/server/api/users/me.ts` validation schemas. Extract to `me.model.ts` if inline.
- [ ] Verify `export type X = typeof XModel.static` pattern is used.

---

## 📚 Phase 4: Documentation & Enforcement

**Objective**: Prevent regression.

### 4.1. Documentation

- [ ] Create `docs/development/best-practices.md`.
  - Section: **Controllers**: "Never pass Context".
  - Section: **Services vs Plugins**: Decision tree.
  - Section: **Models**: Inference patterns.

### 4.2. Linting (Future-proofing)

- [ ] Add `eslint-plugin-local-rules` or configure `no-restricted-syntax` in `biome.json` or `eslint` (if available) to flag usage of `Context` type in `src/server/api`.
  - _Constraint_: If using standard ESLint, add rule `no-restricted-syntax`.
  - _Rule_: `Identifier[name="Context"]` inside `src/server/api` files should be discouraged unless imported from `elysia` for type narrowing (but prefer inference).

---

## 🚀 Execution Order

1.  **Analysis**: Deep read of `src/server/api/users/me.ts` and `src/server/services`.
2.  **Refactor**: Fix `users/me.ts` as the pilot.
3.  **Refactor**: Apply to remaining API controllers.
4.  **Architect**: Split Services/Plugins if necessary.
5.  **Document**: Write the `best-practices.md`.
