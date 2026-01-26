# Implementation Plan: Pre-Launch Hardening & Refactoring

> **Context:** This plan aims to eliminate technical debt, consolidate architecture, and enforce strict security measures before the production launch. Breaking changes are permitted and encouraged to resolve root causes.

## 🛠️ General Requirements

- **Type Safety:** Maintain strict TypeScript compliance. No `any` types. Use TypeBox for validation where applicable.
- **Elysia Best Practices:** Adhere to the Controller/Service/Model pattern. Avoid passing strict contexts; use destructuring.
- **Testing:** Ensure refactored components remain testable.
- **Environment:** Depend on `process.env` validation via `src/lib/env.ts` (or similar) where possible, or throw explicit errors for missing critical secrets.

---

## 🏗️ Phase 1: Architecture Cleanup

### 1.1 Remove Legacy Routes
**Objective:** Eliminate parallel routing structures by removing the legacy API folder.

- **Action:** Delete the entire directory `src/server/api`.
- **Action:** Verify `src/server/modules/index.ts` (or equivalent main router) is robust and includes all necessary module routes.
- **Action:** Update `src/app/api/[[...slugs]]/route.ts`:
  - Ensure it imports the main application handler ONLY from `src/server/modules`.
  - Remove any references to `src/server/api`.

### 1.2 Centralize Security Headers
**Objective:** Prevent configuration drift between Next.js and Elysia.

- **Action:** Create new file `src/server/config/security.ts`.
  - Export a constant `SECURITY_HEADERS` containing the security policy (CSP, HSTS, etc.).
- **Action:** Refactor `next.config.ts`:
  - Import `SECURITY_HEADERS`.
  - Apply them in the `headers()` configuration.
- **Action:** Refactor `src/server/middleware/security-headers.ts`:
  - Import `SECURITY_HEADERS`.
  - Apply them programmatically within the Elysia middleware.

### 1.3 Dead Code Removal
**Objective:** Clean up unused files.

- **Action:** Delete `src/server/middleware/api-key.macro.ts`.

---

## 🔐 Phase 2: Security Core (Critical)

### 2.1 Secure API Keys (SHA-256 Refactor)
**Objective:** Never store API keys in plaintext. Use SHA-256 for performance/security balance.

- **Action:** Update Database Schema (`src/db/schema` or relevant file for `apikeys`):
  - Remove column: `key` (plaintext).
  - Ensure column exists: `prefix` (string, for identification).
  - Ensure column exists: `hash` (string, store SHA-256 hash).
  - Run/Generate migration (or `db:push` since pre-launch) to update the DB.

- **Action:** Refactor `src/server/modules/api-keys/api-keys.service.ts`:
  - **Generation:**
    - Generate a secure random key (e.g., `urlfy_...`).
    - Compute SHA-256 hash of the key.
    - Store `prefix` (e.g., first 8 chars) and `hash` in the database.
    - Return the **plaintext** key to the user (ONLY time it is exposed).
  - **Hashing Utility:** Use `Bun.crypto` or `crypto.subtle` for fast SHA-256 hashing.

- **Action:** Refactor `src/server/middleware/api-key.guard.ts`:
  - **Validation:**
    - Accept `x-api-key` header.
    - Extract prefix to narrow down lookup (optional optimization).
    - Compute SHA-256 hash of the incoming key.
    - Query database finding the record where `hash` matches the computed hash.
    - **Crucial:** Do NOT verify against a plaintext field.

### 2.2 Enforce Secrets
**Objective:** Prevent application startup with insecure defaults.

- **Action:** Modify `src/server/config/plugins.ts`.
- **Implementation:**
  - Locate `jwt` plugin configuration (or `better-auth` config).
  - Remove any fallback string like `|| 'secret'`.
  - Add explicit check:
    ```typescript
    if (!process.env.JWT_SECRET) {
      throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
    }
    ```

### 2.3 Log Sanitization
**Objective:** Prevent credentials from leaking into locks.

- **Action:** Modify `src/server/middleware/auth.middleware.ts`.
- **Action:** Modify `src/server/middleware/rate-limit.ts`.
- **Implementation:**
  - Locate logging statements that output request headers.
  - Apply a masking function to `Authorization`, `Cookie`, and `x-api-key` headers.
  - Example: Log `Authorization: Bearer *****a1b2` or just `[PRESENT]`.

---

## ⚡ Phase 3: Reliability & Infrastructure

### 3.1 Fix IP Resolution & Rate Limiting
**Objective:** Ensure Rate Limiter correctly identifies clients behind proxies.

- **Action:** Modify `src/server/middleware/rate-limit.ts`.
- **Implementation:**
  - Check for `TRUST_PROXY` environment variable.
  - If `TRUST_PROXY` is enabled/true:
    - Trust `X-Forwarded-For` header (parse first IP).
  - If `TRUST_PROXY` is missing/false:
    - **Do NOT** default blindly to `127.0.0.1`.
    - Fallback to `server.requestIP()` or similar Elysia/Bun native IP retrieval.
    - Log a warning ONCE on startup if `TRUST_PROXY` is not set but `X-Forwarded-For` is detected (middleware level).

### 3.2 Standardize Logging
**Objective:** Use the unified logging system.

- **Action:** Modify `src/server/lib/idempotency.ts`.
- **Action:** Replace `console.warn / console.error` with the application's properly configured specific logger (e.g., `logger.warn(...)`).

---

## 📝 Verification Steps

1. **Build Check:** Run `bun run build` to ensure no type errors remain after deleting legacy routes.
2. **Startup Check:** Unset `JWT_SECRET` and verify server crashes. Set it and verify startup.
3. **Auth Flow:** Create a new API Key, verify it works. Check DB to ensure `key` column is gone/empty and `hash` is populated.
4. **Logs:** Make a request with sensitive headers and inspect console output to ensure masking works.
