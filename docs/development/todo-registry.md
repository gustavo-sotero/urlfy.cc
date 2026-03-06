# TODO Registry

## Analytics Provider Selection

- **Location:** `src/lib/hooks/use-analytics-consent.ts`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-ANALYTICS-PROVIDER-SELECTION
- **Status:** Open
- **Context:** Script injection is intentionally deferred until a production analytics vendor is selected.
---

## Dual Better-Auth Instantiation (Architectural Decision)

- **Location:** `apps/web/src/lib/auth.ts`, `apps/api/src/lib/auth.ts`
- **Owner:** gustavo-sotero
- **Tracking ID:** TODO-DUAL-AUTH-BOUNDARY
- **Status:** Intentional — documented here as a known trade-off
- **Context:** Both `apps/web` and `apps/api` instantiate independent `betterAuth` instances sharing
  the same `BETTER_AUTH_SECRET` and `DATABASE_URL`. This allows `apps/web` to validate sessions in
  RSC layouts without an extra network hop to `apps/api` (important for SSR performance), while
  `apps/api` handles all auth mutations (sign-in, sign-up, OAuth callbacks, 2FA, API keys).
  As a consequence, `apps/web` directly holds `DATABASE_URL`, `BETTER_AUTH_SECRET`, and OAuth credentials.
- **Trade-offs to revisit:**
  - Secret surface in web container (database credential + auth secret required in addition to API client).
  - Two email service instances (`apps/web/src/server/lib/email.ts` and `apps/api/src/lib/email.ts`)
    that must be kept in sync when email templates or providers change.
  - Any new Better-Auth plugin must be added to both `auth.ts` files.
- **Revisit when:** Performance budget allows an API call for session validation, or when auth
  complexity warrants isolating all auth state to `apps/api`.