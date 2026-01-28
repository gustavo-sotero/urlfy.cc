# Plan: Migrate Authentication to Elysia Standard Plugins

> **Context**: We are standardizing the API layer by adopting official Elysia plugins, removing third-party dependencies like `jose`, and centralizing logic within the Elysia framework. The deployment target is Node.js/Bun (Docker), so Edge Runtime constraints for cryptography do not apply.

## 1. Dependencies & Configuration

- [ ] **Uninstall** `jose` from `package.json`.
- [ ] **Install** official plugins:
  - `@elysiajs/jwt`
  - `@elysiajs/cors`
  - `@elysiajs/bearer`
  - `@elysiajs/swagger` (ensure version compatibility with `elysia`).

## 2. Global API Configuration (`src/server/api/index.ts`)

- [ ] Import and register plugins globally or via a shared config plugin.
- [ ] **JWT**: Configure `@elysiajs/jwt` with `name: 'jwt'` (or specific name for auth) and `secret: process.env.JWT_SECRET`.
- [ ] **CORS**: Configure `@elysiajs/cors` with restrictive `origin` (based on `process.env.PUBLIC_APP_URL` and `localhost`), `methods`, and `allowedHeaders`.
- [ ] **Bearer**: Register `@elysiajs/bearer` to automatically handle `BS` (Standard Bearer) token extraction for API routes.
- [ ] **Swagger**: Ensure `@elysiajs/openapi` (or `@elysiajs/swagger` depending on installed pkg) is correctly configured to merge with metadata.

## 3. Links Module Refactor (`src/server/modules/links/links.controller.ts`)

- [ ] Update `linksController` to use the `.use(jwt(...))` plugin context (if not global).
- [ ] **Verify Password Endpoint** (`POST /by-code/:code/verify-password`):
  - **Current Behavior**: Verifies password hash via service.
  - **New Behavior**:
    1.  Verify password hash via `LinkService`.
    2.  Use `jwt.sign({ code, type: 'unlock' })` to generate the token.
    3.  Set the cookie `urlfy_unlock_${code}` directly using the `set.cookie` context from Elysia.
    4.  Ensure `httpOnly: true`, `path: '/'`, `maxAge: 5 * 60` (5 min).

## 4. Internal Resolution Module (`src/server/modules/internal/`)

> **Goal**: Replace the Next.js API Route `src/app/api/internal/resolve/[code]/route.ts` with a type-safe Elysia controller.

- [ ] **Create Controller**: `src/server/modules/internal/internal.controller.ts`.
- [ ] **Define Schema**: Create a Drizzle/TypeBox model for the resolve body:
  ```typescript
  {
    depth: t.Number(),
    passwordToken: t.Optional(t.String()), // Changed from hasPasswordCookie boolean
    ip: t.String()
  }
  ```
- [ ] **Implement Endpoint** `POST /resolve/:code`:
  - **Security**: strict check for `x-internal-api` header matching `process.env.INTERNAL_API_SECRET`.
  - **JWT Verification**:
    - If `passwordToken` is provided, use `jwt.verify(passwordToken)`.
    - Validate payload: `{ code: string, type: 'unlock' }`.
    - Verify payload code matches path param code.
  - **Logic**:
    - Call `RateLimiter` (replicate logic from old route).
    - Call `MetricsService.trackRequest()`.
    - Call `RedirectService.resolve()` (or equivalent logic).
  - **Returns**: JSON response matching `ResolveResult` interface expected by middleware.
- [ ] **Register**: Add `internalController` to `src/server/api/index.ts` under `/internal`.

## 5. Middleware Updates (`src/server/middleware/redirect.middleware.ts`)

- [ ] **Remove** `jose` import.
- [ ] **Refactor `checkPasswordCookie`**:
  - Rename to `getPasswordToken`.
  - Function should simply retrieve `request.cookies.get(...)?.value` and return the string | undefined.
  - **Remove** any JWT verification logic from here. The middleware should be dumb regarding crypto.
- [ ] **Update `resolveLink`**:
  - Change payload structure sent to API.
  - Replace `hasPasswordCookie: boolean` with `passwordToken: string | undefined`.

## 6. Cleanup

- [ ] **Delete** `src/app/api/internal/resolve/[code]/route.ts`.
- [ ] **Delete** any unused types or utils related to `jose`.

## 7. Verification

- [ ] Run `bun type-check`.
- [ ] Verify `POST /api/links/:code/verify-password` sets the cookie correctly.
- [ ] Verify accessing a password-protected link redirects correctly (middleware -> internal api -> verify jwt -> success).
- [ ] Verify standard redirects work.
