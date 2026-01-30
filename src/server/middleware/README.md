# Server Middleware

## Purpose

Reusable Elysia middleware and plugins for authentication, security, rate limiting, and request/response handling.

## Structure

- `auth/`: Auth-related middleware (require auth/admin, api key, optional auth)
- `compression.ts`: Response compression
- `csp.middleware.ts`: CSP nonce generation and headers
- `error.middleware.ts`: Centralized error handling
- `rate-limit.ts`: Sliding-window rate limiting utilities

## Patterns Used

- Middleware as Elysia plugins
- No direct business logic; delegates to services when needed
- Typed context augmentation where required

## Adding New Files

1. Use a clear, scoped filename (e.g., `foo.middleware.ts`).
2. Keep HTTP-specific logic here; move business logic to services.
3. Export via index when intended for reuse.
