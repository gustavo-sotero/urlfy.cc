# ElysiaJS Development Best Practices

> 📚 **Official Reference:** [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice.html)

This document outlines the coding standards and architectural patterns adopted in the urlfy.cc codebase to ensure type safety, maintainability, and adherence to ElysiaJS best practices.

---

## 📐 Core Principles

1. **Never pass the entire `Context` object** to controllers or services
2. **Use TypeBox as Single Source of Truth** for validation and types
3. **Services are pure business logic** - no HTTP concerns
4. **Plugins handle request-specific concerns** - authentication, headers, cookies

---

## 🎯 Controllers

### ✅ Correct: Destructure Context Properties

Controllers should destructure only the properties they need from the Context object directly in the handler function:

```typescript
import { Elysia } from 'elysia';

export const linksController = new Elysia({ prefix: '/links' })
  .get('/', async ({ query, user }) => {
    // ✅ Clear dependencies, strictly typed by Elysia inference
    const links = await LinkService.list(user.id, query);
    return { success: true, data: links };
  })
  .post('/', async ({ body, user, set }) => {
    // ✅ Explicitly destructure what you need
    try {
      const link = await LinkService.create(body, user.id);
      return { success: true, data: link };
    } catch (error) {
      set.status = 400;
      return { success: false, error: { code: 'CREATE_FAILED' } };
    }
  });
```

### ❌ Incorrect: Passing Context Object

**Never** pass the entire Context or use `context as typeof context`:

```typescript
// ❌ DON'T DO THIS
.get('/', async (context) => {
  const { user, query } = context as typeof context & {
    user: User;
    query: ListQuery;
  };
  // Late destructuring, unclear dependencies, breaks type inference
  return Controller.handle(context); // ❌ Passing entire context
})

// ❌ DON'T DO THIS
abstract class Controller {
  static handle(ctx: Context) { // ❌ Using Context type
    const { body, user } = ctx;
    // ...
  }
}
```

### Why This Matters

- **Type Safety:** Elysia's type inference works best when you destructure inline
- **Clear Dependencies:** Immediately visible what data the handler needs
- **Testability:** Easier to mock specific properties rather than entire Context
- **Performance:** Avoids unnecessary property access

---

## 🏢 Services vs Plugins

### Services: Pure Business Logic

Use object literals with namespaced methods for non-request-dependent logic:

```typescript
// ✅ Service: Pure business logic
export const LinkService = {
  async create(input: CreateLinkInput, userId: string): Promise<Link> {
    // Pure data transformation, no HTTP concerns
    const code = await generateUniqueCode();
    return db.insert(links).values({ ...input, userId, shortCode: code });
  },

  async getById(linkId: string): Promise<Link | null> {
    return db.query.links.findFirst({ where: eq(links.id, linkId) });
  }
};
```

**Characteristics:**

- ✅ Input: Plain data (DTOs, IDs)
- ✅ Output: Data or errors
- ✅ Dependencies: Database, Redis, other Services
- ✅ No access to: Headers, Cookies, Request, Response

### Plugins: Request-Specific Utilities

Use Elysia Plugins or Macros for request-dependent logic:

```typescript
// ✅ Plugin: Derives data from request context
import { Elysia } from 'elysia';

export const authPlugin = new Elysia({ name: 'auth' }).derive(
  async ({ headers, cookie, set }) => {
    const sessionToken = cookie.session?.value || headers.authorization;

    if (!sessionToken) {
      return { user: null, isAuthenticated: false };
    }

    const session = await validateSession(sessionToken);
    return {
      user: session?.user || null,
      isAuthenticated: !!session,
      session
    };
  }
);

// Usage
const app = new Elysia()
  .use(authPlugin)
  .get('/profile', async ({ user, isAuthenticated }) => {
    // user and isAuthenticated are now available
  });
```

**Characteristics:**

- ✅ Input: Context properties (headers, cookies, request)
- ✅ Output: Derived state or side effects
- ✅ Examples: Authentication, GeoIP resolution, setting headers

### Decision Tree

```
Does it need access to HTTP specifics (headers, cookies, set)?
├─ Yes → Use Plugin/Macro
└─ No  → Use Service (object literal)

Does it depend on the request context?
├─ Yes → Plugin
└─ No  → Service
```

### Service Pattern Decision

We use object literals (`export const XService = { ... }`) for module services.
This provides namespace-like organization without the overhead of classes.
Early planning docs referenced "abstract class with static methods", but implementation standardized on object literals for consistency and idiomatic JavaScript/TypeScript.

---

## 📦 Models: Single Source of Truth

### TypeBox Schema → Type Inference

Always define schemas using TypeBox and infer types with `Static<typeof>`:

```typescript
import { type Static, t } from 'elysia';

// ✅ Define schema once
export const LinkCreateBody = t.Object({
  url: t.String({ maxLength: 2048 }),
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
  expiresAt: t.Optional(t.String({ format: 'date-time' }))
});

// ✅ Infer type from schema
export type LinkCreateBodyType = Static<typeof LinkCreateBody>;

// ✅ Use in controller with reference
export const linksController = new Elysia()
  .model({
    'links.create': LinkCreateBody
  })
  .post('/', handler, {
    body: 'links.create' // Reference by name for caching
  });
```

### ❌ Anti-Pattern: Separate Interface

**Never** define a separate TypeScript interface that duplicates the schema:

```typescript
// ❌ DON'T DO THIS
interface LinkCreateBody {
  url: string;
  customAlias?: string;
  expiresAt?: string;
}

// This duplicates the validation schema and can get out of sync
```

### Model Organization

Group related models by feature:

```typescript
// ✅ Organized by domain
export const LinksModel = {
  create: LinkCreateBody,
  update: LinkUpdateBody,
  response: LinkResponse,
  query: LinkQuery
};

// ✅ Register models for OpenAPI + type cache
const linksModels = new Elysia().model(LinksModel);

export const linksController = new Elysia()
  .use(linksModels)
  .post('/', handler, { body: 'create' });
```

---

## 🧪 Testing

### Controller Testing with `handle()`

Test controllers using the `handle()` method:

```typescript
import { describe, expect, it } from 'bun:test';
import { linksController } from './links.controller';

describe('Links Controller', () => {
  it('should create link', async () => {
    const response = await linksController
      .handle(
        new Request('http://localhost/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com' })
        })
      )
      .then((r) => r.json());

    expect(response.success).toBe(true);
    expect(response.data.shortCode).toBeDefined();
  });
});
```

### Type Assertions After Auth Middleware

After `requireAuth` middleware, `user` is guaranteed to be non-null (the middleware returns 401 if not), but TypeScript can't infer this. Use non-null assertion:

```typescript
import { requireAuth } from '@/server/middleware/auth.middleware';

export const protectedRoute = new Elysia()
  .use(requireAuth)
  .get('/', async ({ user }) => {
    // user is User | null here by type, but guaranteed non-null by middleware
    // Option 1: Non-null assertion (recommended)
    return { userId: user!.id };

    // Option 2: Runtime check (defensive, but redundant)
    if (!user) throw new Error('Unexpected: user is null after requireAuth');
    return { userId: user.id };
  });
```

**Note on Linter Warnings:**

Your linter may flag non-null assertions (`user!`) as forbidden. This is expected and acceptable in the following contexts:

- **After `requireAuth` middleware**: The middleware enforces non-null by returning 401 if user is null
- **After `requireApiKey` middleware**: The middleware enforces non-null by returning 401 if apiKey is null

In these cases, the linter warning can be suppressed with a comment explaining the guarantee:

```typescript
.get('/', async ({ user }) => {
  // user is guaranteed non-null by requireAuth middleware
  return { userId: user!.id };
})
```

### Service Testing

Services are pure functions - test them directly:

```typescript
import { describe, expect, it } from 'bun:test';
import { LinkService } from './link.service';

describe('LinkService', () => {
  it('should create link with generated code', async () => {
    const link = await LinkService.create(
      { url: 'https://example.com' },
      'user_123'
    );

    expect(link.shortCode).toHaveLength(7);
    expect(link.userId).toBe('user_123');
  });
});
```

---

## 🔍 Common Mistakes

### 1. Context Leakage

```typescript
// ❌ WRONG
.get('/', async (ctx) => {
  return Handler.process(ctx); // Passing entire context
})

// ✅ CORRECT
.get('/', async ({ user, query }) => {
  return Handler.process({ user, query }); // Explicit data
})
```

### 2. Service with HTTP Concerns

```typescript
// ❌ WRONG: Service accessing headers
export class EmailService {
  static async send(headers: Headers) {
    // ❌ Headers in service
    const host = headers.get('host');
    // ...
  }
}

// ✅ CORRECT: Pass derived data
export class EmailService {
  static async send(recipientEmail: string, baseUrl: string) {
    // Pure business logic
  }
}
```

### 3. Duplicate Type Definitions

```typescript
// ❌ WRONG
const schema = t.Object({ name: t.String() });
interface MyType {
  name: string;
} // Duplication

// ✅ CORRECT
const schema = t.Object({ name: t.String() });
type MyType = Static<typeof schema>; // Single source
```

---

## 📁 File Structure

Feature-based organization following MVC pattern:

```
apps/api/src/server/
├── modules/                    # Feature-based modules
│   ├── links/
│   │   ├── links.controller.ts   # Elysia instance with routes
│   │   ├── links.service.ts      # Business logic (static class)
│   │   ├── links.schema.ts       # TypeBox models
│   │   └── __tests__/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.plugin.ts        # Request-dependent logic
│   │   └── auth.schema.ts
│   └── analytics/
├── middleware/                 # Shared middleware
├── services/                   # Shared services
└── lib/                        # Utilities
```

---

## 🔄 Migration Checklist

When refactoring existing code:

- [ ] Remove all `context as typeof context` casts
- [ ] Destructure Context properties inline: `async ({ user, body, set })`
- [ ] Ensure Services don't access headers/cookies/request
- [ ] Convert HTTP concerns to Plugins if needed
- [ ] Verify TypeBox schemas are used for validation
- [ ] Use `Static<typeof>` for type inference
- [ ] Register models with `.model()` for OpenAPI
- [ ] Update tests to use `.handle()` for controllers
- [ ] Remove duplicate interfaces

---

## 📚 Additional Resources

Use #fetch if necessary.

- [ElysiaJS Official Documentation](https://elysiajs.com)
- [ElysiaJS Best Practices](https://elysiajs.com/essential/best-practice.html)
- [TypeBox Documentation](https://github.com/sinclairzx81/typebox)
- [Project Architecture Overview](../architecture/overview.md)

---

## 🛡️ Enforcement & Code Quality

### Linting Configuration

The project uses **Biome** for linting. Key rules enforced:

1. **No unnecessary type assertions**: Prefer type inference
2. **No non-null assertions in unsafe contexts**: Only after middleware guarantees
3. **Consistent destructuring**: Must destructure Context inline

### Code Review Checklist

When reviewing PRs, verify:

- [ ] No `Context` type imports in controller files
- [ ] No `ctx as typeof ctx` patterns
- [ ] Destructuring happens inline: `async ({ user, body })`
- [ ] Services don't import from `elysia` (except types for shared utilities)
- [ ] HTTP concerns (headers, cookies) are in Plugins, not Services
- [ ] TypeBox schemas exist for all request/response bodies
- [ ] No duplicate TypeScript interfaces matching schemas

### Pre-commit Hooks

```bash
# Run before committing
bun run type-check  # TypeScript compilation
bun run lint        # Biome linting
bun test           # Unit tests
```

---

## 🎓 Learning Resources & Examples

### Real-World Examples in Codebase

**Good Examples:**

- ✅ `src/server/modules/api-keys/api-keys.controller.ts` - Proper destructuring
- ✅ `apps/api/src/server/modules/users/me.controller.ts` - Clean Context usage
- ✅ `apps/api/src/server/modules/links/links.service.ts` - Pure business logic

**Before/After Refactorings:**

- 📝 See commit history for `links.controller.ts` (2026-01-23)

### ElysiaJS Patterns We Use

| Pattern     | Use Case                        | Example                   |
| ----------- | ------------------------------- | ------------------------- |
| `.derive()` | Add derived state to context    | Auth plugin adding `user` |
| `.macro()`  | Add custom validation           | `isSignedIn()` macro      |
| `.model()`  | Register schemas for reuse      | OpenAPI + type caching    |
| `.guard()`  | Group routes with shared config | Protected routes          |
| `.use()`    | Compose plugins                 | Middleware injection      |

---

## 🐛 Debugging Tips

### Type Inference Issues

If Elysia's type inference breaks:

1. **Check for Context leakage**: Are you passing `ctx` around?
2. **Verify destructuring**: Must be inline, not in separate variable
3. **Check plugin order**: `.use(requireAuth)` must come before routes that need `user`
4. **Model registration**: Ensure schemas are registered via `.model()`

```typescript
// ❌ BREAKS TYPE INFERENCE
async (ctx) => {
  const props = ctx; // Intermediate variable
  return handler(props);
};

// ✅ MAINTAINS TYPE INFERENCE
async ({ user, body }) => {
  return handler({ user, body });
};
```

### Runtime Debugging

```typescript
// Add trace logging to controllers
.get('/', async ({ user, query }) => {
  console.log('[TRACE]', { user: user?.id, query });
  // ...
})

// Add OpenTelemetry spans for Services
import { trace } from '@opentelemetry/api';

export abstract class LinkService {
  static async create(input: CreateInput) {
    const span = trace.getTracer('link-service').startSpan('create');
    try {
      // logic
      return result;
    } finally {
      span.end();
    }
  }
}
```

---

**Last Updated:** 2026-01-23
**Maintainer:** Engineering Team
