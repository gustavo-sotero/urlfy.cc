# Plan: Fix Codebase Security & Technical Debt Issues

> **Source:** CODEBASE_ANALYSIS_2026-01-28.md  
> **Priority:** Security vulnerabilities first, then API consistency, then refactoring  
> **Estimated Effort:** ~4-6 hours

---

## Phase 1: Security Critical (SSRF & Headers)

### 1.1 Add SSRF Protection to URL Validator

**File:** `src/server/services/url-validator.ts`

**Problem:** URL validation does not block private/internal network targets, exposing the server to SSRF attacks when fetching OG metadata or validating URLs.

**Implementation:**

1. Create a utility function `isPrivateIP(ip: string): boolean` that checks against RFC 1918 and loopback ranges:

```typescript
const PRIVATE_IP_RANGES = [
  // IPv4
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  // IPv6
  /^::1$/, // Loopback
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local (fc00::/7)
  /^fd/i // Unique local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.internal',
  '*.local',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254' // AWS/Azure metadata
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some((pattern) => {
    if (pattern.startsWith('*.')) {
      return lower.endsWith(pattern.slice(1)) || lower === pattern.slice(2);
    }
    return lower === pattern;
  });
}
```

2. Create an async function `validateUrlSafe(url: string): Promise<ValidationResult>` that performs DNS resolution:

```typescript
import { lookup } from 'node:dns/promises';

export async function validateUrlSafe(url: string): Promise<ValidationResult> {
  // Run synchronous checks first (format, protocol, shortener block)
  const syncResult = validateUrl(url);
  if (!syncResult.valid) {
    return syncResult;
  }

  const { hostname } = new URL(url);

  // Block known dangerous hostnames
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: 'URL_INTERNAL_BLOCKED' };
  }

  // Resolve DNS and check IP
  try {
    const { address } = await lookup(hostname, { timeout: 2000 });
    if (isPrivateIP(address)) {
      return { valid: false, error: 'URL_INTERNAL_BLOCKED' };
    }
  } catch (error) {
    // DNS resolution failed - block to be safe
    return { valid: false, error: 'URL_RESOLUTION_FAILED' };
  }

  return { valid: true };
}
```

3. Add the new error code to `src/server/lib/errors.ts`:

```typescript
URL_INTERNAL_BLOCKED: {
  status: 400,
  code: 'URL_INTERNAL_BLOCKED',
  message: 'URLs pointing to internal or private networks are not allowed',
},
URL_RESOLUTION_FAILED: {
  status: 400,
  code: 'URL_RESOLUTION_FAILED',
  message: 'Could not resolve URL hostname',
},
```

4. Update link creation controllers to use `validateUrlSafe()` instead of `validateUrl()`:
   - `src/server/modules/links/controllers/public.controller.ts`
   - `src/server/modules/links/controllers/protected.controller.ts`

**Type Safety:** Export proper TypeScript types:

```typescript
export interface ValidationResult {
  valid: boolean;
  error?:
    | 'INVALID_FORMAT'
    | 'INVALID_PROTOCOL'
    | 'URL_SHORTENER_NOT_ALLOWED'
    | 'URL_BANNED'
    | 'URL_INTERNAL_BLOCKED'
    | 'URL_RESOLUTION_FAILED';
  warnings?: string[];
}
```

---

### 1.2 Enable HSTS in Development

**File:** `src/server/config/security.ts`

**Problem:** Security scanner flags missing HSTS in development, causing false positives in reports.

**Implementation:**

Locate the HSTS configuration (around line 33-41) and remove the production-only condition:

```typescript
// BEFORE
const securityHeaders = {
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  })
  // ...
};

// AFTER
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  // ...
};
```

**Note:** This is safe because browsers ignore HSTS over HTTP (localhost), and it ensures consistent security posture across environments.

---

## Phase 2: API Consistency & Standards

### 2.1 Fix Error Status Codes (422 → 400)

**File:** `src/server/lib/errors.ts`

**Problem:** `URL_SHORTENER_NOT_ALLOWED` returns `422`, but tests and security scanners expect `400` for input validation errors.

**Implementation:**

Locate the error mapping (around line 38-43) and update:

```typescript
// BEFORE
URL_SHORTENER_NOT_ALLOWED: {
  status: 422,
  code: 'URL_SHORTENER_NOT_ALLOWED',
  message: 'URLs from other URL shorteners are not allowed',
},

// AFTER
URL_SHORTENER_NOT_ALLOWED: {
  status: 400,
  code: 'URL_SHORTENER_NOT_ALLOWED',
  message: 'URLs from other URL shorteners are not allowed',
},
```

**Review:** Check if other `422` codes should also be `400`:

- `URL_MALICIOUS` → Keep 422 (semantic: processable but rejected by policy)
- `VALIDATION_ERROR` → Should already be 400

---

### 2.2 Standardize Client IP Extraction in Bulk Controller

**File:** `src/server/modules/links/controllers/protected.controller.ts`

**Problem:** The `/bulk` endpoint manually reads `x-forwarded-for` header, which can contain a comma-separated chain and doesn't normalize to client IP.

**Implementation:**

1. Locate the bulk creation handler (around line 225-229):

```typescript
// BEFORE
const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown';
const ipHash = hashIp(clientIp);

// AFTER
import { getClientIp } from '@/lib/utils';
// In handler:
const clientIp = getClientIp(request);
const ipHash = hashIp(clientIp);
```

2. Ensure `getClientIp` is properly typed:

```typescript
// In src/lib/utils.ts
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take only the first IP (client IP)
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
```

---

### 2.3 Align Unlock Cookie Security Policy

**File:** `src/server/modules/links/controllers/public.controller.ts`

**Problem:** Password unlock cookie uses `SameSite=Lax`, while auth cookies use `SameSite=Strict`, creating inconsistent security posture.

**Implementation:**

Locate the cookie setting logic (around line 154-171):

```typescript
// BEFORE
cookie.urlfy_unlock.set({
  value: unlockToken,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 5, // 5 minutes
  path: '/'
});

// AFTER
cookie.urlfy_unlock.set({
  value: unlockToken,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 60 * 5, // 5 minutes
  path: '/'
});
```

---

## Phase 3: Reliability & Refactoring

### 3.1 Refactor Redirect Middleware into Modules

**File:** `src/server/middleware/redirect.middleware.ts` (~450 lines)

**Problem:** Middleware mixes validation, resolution, error handling, and analytics in a single file.

**Target Structure:**

```
src/server/middleware/redirect/
├── index.ts              # Main middleware entry point (orchestration only)
├── validator.ts          # Request validation (host, depth, method)
├── resolver.ts           # Link resolution (internal API call)
├── error-handler.ts      # Error code mapping and response shaping
└── types.ts              # Shared types for the module
```

**Implementation:**

1. **Create `types.ts`:**

```typescript
export interface ResolvedLink {
  id: string;
  originalUrl: string;
  redirectType: 301 | 302;
  isPasswordProtected: boolean;
}

export interface RedirectContext {
  code: string;
  depth: number;
  clientIp: string;
  userAgent: string;
}

export type RedirectError =
  | 'LINK_NOT_FOUND'
  | 'LINK_EXPIRED'
  | 'LINK_BANNED'
  | 'LINK_INACTIVE'
  | 'MAX_CLICKS_REACHED'
  | 'PASSWORD_REQUIRED'
  | 'REDIRECT_LOOP';
```

2. **Create `validator.ts`:**

```typescript
import type { RedirectContext } from './types';

const MAX_REDIRECT_DEPTH = 3;
const ALLOWED_HOSTS = ['urlfy.cc', 'www.urlfy.cc', 'localhost'];

export function validateRedirectRequest(
  request: Request,
  code: string
):
  | { valid: true; context: RedirectContext }
  | { valid: false; error: string; status: number } {
  // Host validation
  const host = request.headers.get('host');
  if (!host || !ALLOWED_HOSTS.some((h) => host.includes(h))) {
    return { valid: false, error: 'INVALID_HOST', status: 421 };
  }

  // Depth validation
  const depthHeader = request.headers.get('x-redirect-depth');
  const depth = depthHeader ? parseInt(depthHeader, 10) : 0;
  if (depth >= MAX_REDIRECT_DEPTH) {
    return { valid: false, error: 'REDIRECT_LOOP', status: 421 };
  }

  return {
    valid: true,
    context: {
      code,
      depth,
      clientIp: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? 'unknown'
    }
  };
}
```

3. **Create `resolver.ts`:**

```typescript
import type { ResolvedLink } from './types';
import { env } from '@/lib/env';

const INTERNAL_API_BASE = env.INTERNAL_API_URL;
const INTERNAL_SECRET = env.INTERNAL_API_SECRET;

export async function resolveLink(code: string): Promise<ResolvedLink | null> {
  const response = await fetch(
    `${INTERNAL_API_BASE}/internal/links/${code}/resolve`,
    {
      headers: {
        'x-internal-secret': INTERNAL_SECRET
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Resolve failed: ${response.status}`);
  }

  return response.json() as Promise<ResolvedLink>;
}
```

4. **Create `error-handler.ts`:**

```typescript
import type { RedirectError } from './types';

const ERROR_RESPONSES: Record<
  RedirectError,
  { status: number; redirect?: string }
> = {
  LINK_NOT_FOUND: { status: 404 },
  LINK_EXPIRED: { status: 410 },
  LINK_BANNED: { status: 451 },
  LINK_INACTIVE: { status: 404 },
  MAX_CLICKS_REACHED: { status: 410 },
  PASSWORD_REQUIRED: { status: 401, redirect: '/unlock/{code}' },
  REDIRECT_LOOP: { status: 421 }
};

export function handleRedirectError(
  error: RedirectError,
  code: string
): Response {
  const config = ERROR_RESPONSES[error];

  if (config.redirect) {
    return Response.redirect(config.redirect.replace('{code}', code), 302);
  }

  return new Response(null, { status: config.status });
}
```

5. **Refactor `index.ts`:** Keep only orchestration logic, importing from the modules above.

---

### 3.2 Add Jittered Backoff to Stampede Protection

**File:** `src/server/services/redirect.service.ts`

**Problem:** Fixed 50ms sleep causes synchronized retries (thundering herd effect).

**Implementation:**

Locate the stampede wait logic (around line 310-314):

```typescript
// BEFORE
await Bun.sleep(50);

// AFTER
// Jittered backoff: 50-100ms to desynchronize retries
const jitter = 50 + Math.floor(Math.random() * 50);
await Bun.sleep(jitter);
```

**Optional Enhancement:** Add retry loop with exponential backoff:

```typescript
const MAX_RETRIES = 3;
const BASE_DELAY = 50;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const cached = await redis.get(`link:${code}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Exponential backoff with jitter
  const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 50;
  await Bun.sleep(delay);
}

// Fallback to DB after retries exhausted
return await this.fetchFromDatabase(code);
```

---

## Testing Checklist

After implementation, verify:

- [ ] `bun test src/server/services/url-validator.test.ts` - SSRF blocking
- [ ] `bun run security:report` - All checks pass
- [ ] `bun test tests/integration/redirect.test.ts` - Redirect flow works
- [ ] `bun test tests/integration/links.test.ts` - Link creation with new validation
- [ ] Manual test: Create link with `http://localhost:8080` → Should fail
- [ ] Manual test: Create link with `http://169.254.169.254` → Should fail

---

## Files Modified Summary

| File                                                           | Change                           |
| -------------------------------------------------------------- | -------------------------------- |
| `src/server/services/url-validator.ts`                         | Add SSRF protection functions    |
| `src/server/lib/errors.ts`                                     | Add new error codes, fix 422→400 |
| `src/server/config/security.ts`                                | Enable HSTS in all environments  |
| `src/server/modules/links/controllers/protected.controller.ts` | Use `getClientIp()`              |
| `src/server/modules/links/controllers/public.controller.ts`    | Fix cookie SameSite              |
| `src/server/middleware/redirect/` (new)                        | Refactored middleware modules    |
| `src/server/services/redirect.service.ts`                      | Add jittered backoff             |
