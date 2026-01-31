# Plan: Fix Codebase Issues - urlfy.cc

> Implementation plan based on CODEBASE_ANALYSIS_2026-01-30.md findings

---

## Priority 1: Critical

### 1.1 Fix GitHub Actions Secrets Configuration

**File:** `.github/workflows/security.yml`

**Problem:** Workflow uses `||` fallback with hardcoded placeholder values, allowing CI to run with insecure defaults if secrets aren't configured.

**Current (unsafe):**

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET || 'production-jwt-secret-minimum-32-chars-long-placeholder' }}
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET || 'production-auth-secret-minimum-32-chars-long' }}
  AUTH_SECRET: ${{ secrets.AUTH_SECRET || 'production-auth-secret-minimum-32-chars-long-x' }}
```

**Target (fail-fast):**

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
  AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
```

**Action Items:**

1. Read `.github/workflows/security.yml` to locate all `|| 'placeholder'` patterns
2. Remove all fallback values from secrets references
3. Add a validation job step at workflow start:

```yaml
jobs:
  validate-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Validate required secrets
        run: |
          missing_secrets=()
          [[ -z "${{ secrets.JWT_SECRET }}" ]] && missing_secrets+=("JWT_SECRET")
          [[ -z "${{ secrets.BETTER_AUTH_SECRET }}" ]] && missing_secrets+=("BETTER_AUTH_SECRET")
          [[ -z "${{ secrets.AUTH_SECRET }}" ]] && missing_secrets+=("AUTH_SECRET")

          if [[ ${#missing_secrets[@]} -gt 0 ]]; then
            echo "::error::Missing required secrets: ${missing_secrets[*]}"
            exit 1
          fi
          echo "✅ All required secrets are configured"
```

---

## Priority 2: High

### 2.1 Replace console.log with Structured Logger

**Affected Files:**

- `src/server/lib/telemetry.ts` (~5 instances)
- `src/db/index.ts` (~2 instances)
- `src/server/init.ts` (~3 instances)

**Logger Utility:** `src/server/lib/logger.ts`

**Current Pattern (avoid):**

```typescript
console.log('[Telemetry] OpenTelemetry initialized');
console.log(`Database connected to ${host}`);
```

**Target Pattern (use):**

```typescript
import { createLogger } from '@/server/lib/logger';

const logger = createLogger('telemetry'); // or 'database', 'init'

logger.info('OpenTelemetry initialized');
logger.info('Database connected', { host });
```

**Action Items:**

1. **telemetry.ts:**
   - Import `createLogger` at top of file
   - Create logger: `const logger = createLogger('telemetry');`
   - Replace all `console.log` with appropriate log level:
     - Startup messages → `logger.info()`
     - Debug info → `logger.debug()`
     - Warnings → `logger.warn()`

2. **db/index.ts:**
   - Import `createLogger`
   - Create logger: `const logger = createLogger('database');`
   - Replace connection logs with `logger.info('Connected', { host, database })`
   - Replace error logs with `logger.error('Connection failed', { error })`

3. **init.ts:**
   - Import `createLogger`
   - Create logger: `const logger = createLogger('init');`
   - Replace startup sequence logs

**Note:** Keep `console.log` in:

- `src/db/scripts/seed-*.ts` (CLI output is intentional)
- Test files (debugging purposes)
- `tests/load/*.ts` (k6 output)

---

### 2.2 Migrate Commented Tests to Integration Suite

**Source File:** `src/server/services/__tests__/link.service.test.ts`
**Target File:** `tests/integration/link-service.integration.test.ts`

**Problem:** ~380 lines of tests are commented out due to Bun mock limitations with database operations.

**Solution:** Create integration tests using real test database.

**Action Items:**

1. Create new integration test file with proper setup:

```typescript
// tests/integration/link-service.integration.test.ts
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach
} from 'bun:test';
import { db } from '@/db';
import { links, users } from '@/db/schema';
import { LinkService } from '@/server/services/link.service';
import { eq } from 'drizzle-orm';

// Type definitions for test data
interface TestUser {
  id: string;
  email: string;
  name: string;
}

interface TestLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  userId: string | null;
}

describe('LinkService Integration Tests', () => {
  let testUser: TestUser;
  const createdLinkIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        emailVerified: true
      })
      .returning();
    testUser = user;
  });

  afterAll(async () => {
    // Cleanup: Delete created links and test user
    for (const linkId of createdLinkIds) {
      await db.delete(links).where(eq(links.id, linkId));
    }
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  beforeEach(() => {
    // Reset any per-test state
  });

  describe('create', () => {
    it('should create a link with generated short code', async () => {
      const result = await LinkService.create({
        url: 'https://example.com/test-integration',
        userId: testUser.id
      });

      expect(result.shortCode).toHaveLength(7);
      expect(result.originalUrl).toBe('https://example.com/test-integration');
      createdLinkIds.push(result.id);
    });

    it('should create a link with custom alias', async () => {
      const customAlias = `test-${Date.now()}`;
      const result = await LinkService.create({
        url: 'https://example.com/custom',
        customAlias,
        userId: testUser.id
      });

      expect(result.shortCode).toBe(customAlias);
      createdLinkIds.push(result.id);
    });

    it('should reject duplicate custom alias', async () => {
      const customAlias = `dup-${Date.now()}`;

      // First creation should succeed
      const first = await LinkService.create({
        url: 'https://example.com/first',
        customAlias,
        userId: testUser.id
      });
      createdLinkIds.push(first.id);

      // Second creation with same alias should fail
      await expect(
        LinkService.create({
          url: 'https://example.com/second',
          customAlias,
          userId: testUser.id
        })
      ).rejects.toThrow();
    });
  });

  describe('getByShortCode', () => {
    it('should return link by short code', async () => {
      const created = await LinkService.create({
        url: 'https://example.com/get-test',
        userId: testUser.id
      });
      createdLinkIds.push(created.id);

      const found = await LinkService.getByShortCode(created.shortCode);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent code', async () => {
      const found = await LinkService.getByShortCode('nonexistent123');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update link properties', async () => {
      const created = await LinkService.create({
        url: 'https://example.com/update-test',
        userId: testUser.id
      });
      createdLinkIds.push(created.id);

      const updated = await LinkService.update(created.id, testUser.id, {
        isActive: false,
        metaTitle: 'Updated Title'
      });

      expect(updated.isActive).toBe(false);
      expect(updated.metaTitle).toBe('Updated Title');
    });
  });

  describe('delete (soft)', () => {
    it('should soft delete a link', async () => {
      const created = await LinkService.create({
        url: 'https://example.com/delete-test',
        userId: testUser.id
      });
      createdLinkIds.push(created.id);

      await LinkService.softDelete(created.id, testUser.id);

      // Should not be found by regular query
      const found = await LinkService.getByShortCode(created.shortCode);
      expect(found).toBeNull();

      // Should exist in database with deletedAt set
      const [dbLink] = await db
        .select()
        .from(links)
        .where(eq(links.id, created.id));
      expect(dbLink.deletedAt).not.toBeNull();
    });
  });
});
```

2. Remove the TODO comment from `link.service.test.ts`:

```typescript
// Remove this block:
// DATABASE-DEPENDENT TESTS - Commented out due to Bun mock limitations
// These tests require database mocking which doesn't work reliably in Bun.
// TODO: Move these to integration tests with a real test database.
```

3. Update `package.json` to add integration test script:

```json
{
  "scripts": {
    "test:integration": "bun test tests/integration/"
  }
}
```

---

## Priority 3: Medium

### 3.1 Split security.test.ts into Focused Test Suites

**Source File:** `tests/security/security.test.ts` (647 lines)

**Problem:**

- File is too large with 12 describe blocks
- Contains duplicate blocks (SSRF, Rate Limiting, Anti-Abuse appear twice)
- Has stub tests (`test.todo()`) that need implementation

**Target Structure:**

```
tests/security/
├── injection.security.test.ts      # SQL Injection, XSS
├── ssrf.security.test.ts           # SSRF Prevention, URL Validation
├── rate-limiting.security.test.ts  # Rate Limiting, Anti-Abuse
├── headers.security.test.ts        # Security Headers, CORS
├── sanitization.security.test.ts   # Input Sanitization
└── helpers/
    └── security-test-setup.ts      # Shared mocks (Redis, telemetry)
```

**Action Items:**

1. **Create shared test setup helper:**

```typescript
// tests/security/helpers/security-test-setup.ts
import { mock } from 'bun:test';

export interface MockRedisClient {
  get: ReturnType<typeof mock>;
  set: ReturnType<typeof mock>;
  del: ReturnType<typeof mock>;
  zadd: ReturnType<typeof mock>;
  zremrangebyscore: ReturnType<typeof mock>;
  zcard: ReturnType<typeof mock>;
  expire: ReturnType<typeof mock>;
  incr: ReturnType<typeof mock>;
  ttl: ReturnType<typeof mock>;
  exists: ReturnType<typeof mock>;
}

export function createMockRedisClient(): MockRedisClient {
  return {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    zadd: mock(() => Promise.resolve(1)),
    zremrangebyscore: mock(() => Promise.resolve(0)),
    zcard: mock(() => Promise.resolve(0)),
    expire: mock(() => Promise.resolve(1)),
    incr: mock(() => Promise.resolve(1)),
    ttl: mock(() => Promise.resolve(-1)),
    exists: mock(() => Promise.resolve(0))
  };
}

export function createMockTelemetry() {
  return {
    recordMetric: mock(() => {}),
    createSpan: mock(() => ({
      end: mock(() => {}),
      setAttributes: mock(() => {})
    }))
  };
}

export function resetAllMocks(mockClient: MockRedisClient) {
  Object.values(mockClient).forEach((fn) => fn.mockClear());
}
```

2. **Create injection.security.test.ts:**

```typescript
// tests/security/injection.security.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createMockRedisClient,
  createMockTelemetry
} from './helpers/security-test-setup';

describe('SQL Injection Prevention', () => {
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    '1; DELETE FROM links WHERE 1=1',
    "' UNION SELECT * FROM users --"
  ];

  sqlPayloads.forEach((payload) => {
    it(`should sanitize SQL injection attempt: ${payload.substring(0, 30)}...`, () => {
      // Test implementation
    });
  });
});

describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>'
  ];

  xssPayloads.forEach((payload) => {
    it(`should sanitize XSS attempt: ${payload.substring(0, 30)}...`, () => {
      // Test implementation
    });
  });
});
```

3. **Create ssrf.security.test.ts:**

```typescript
// tests/security/ssrf.security.test.ts
import { describe, it, expect } from 'bun:test';
import { UrlValidatorService } from '@/server/services/url-validator';

describe('SSRF Prevention', () => {
  const privateIPs = [
    'http://127.0.0.1',
    'http://localhost',
    'http://192.168.1.1',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://[::1]'
  ];

  privateIPs.forEach((url) => {
    it(`should block private IP: ${url}`, async () => {
      const result = await UrlValidatorService.validate(url);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SSRF_DETECTED');
    });
  });
});

describe('URL Validation', () => {
  it('should accept valid HTTPS URL', async () => {
    const result = await UrlValidatorService.validate('https://example.com');
    expect(result.valid).toBe(true);
  });

  it('should reject invalid protocol', async () => {
    const result = await UrlValidatorService.validate('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_PROTOCOL');
  });

  it('should reject other URL shorteners', async () => {
    const shorteners = ['https://bit.ly/abc', 'https://tinyurl.com/xyz'];
    for (const url of shorteners) {
      const result = await UrlValidatorService.validate(url);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SHORTENER_NOT_ALLOWED');
    }
  });
});
```

4. **Create rate-limiting.security.test.ts:**

```typescript
// tests/security/rate-limiting.security.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  createMockRedisClient,
  resetAllMocks,
  type MockRedisClient
} from './helpers/security-test-setup';
import { RateLimiter } from '@/server/lib/rate-limiter';

describe('Rate Limiting', () => {
  let mockRedis: MockRedisClient;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
    resetAllMocks(mockRedis);
  });

  it('should allow requests under limit', async () => {
    mockRedis.zcard.mockResolvedValue(5);
    // Test rate limiter with mocked Redis
  });

  it('should block requests over limit', async () => {
    mockRedis.zcard.mockResolvedValue(100);
    // Test rate limiter rejection
  });

  it('should use sliding window algorithm', async () => {
    // Verify ZREMRANGEBYSCORE is called to remove old entries
    // Verify ZADD adds new entry with timestamp
  });
});

describe('Anti-Abuse Detection', () => {
  it('should detect burst patterns', async () => {
    // Test burst detection logic
  });

  it('should trigger IP blocking on abuse threshold', async () => {
    // Test IP block mechanism
  });
});
```

5. **Create headers.security.test.ts with real implementations:**

```typescript
// tests/security/headers.security.test.ts
import { describe, it, expect } from 'bun:test';
import { SECURITY_HEADERS } from '@/server/config/security';

describe('Security Headers', () => {
  it('should have Strict-Transport-Security header', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
  });

  it('should have X-Content-Type-Options header', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should have X-Frame-Options header', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('should have Referrer-Policy header', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe(
      'strict-origin-when-cross-origin'
    );
  });

  it('should have Permissions-Policy header', () => {
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()');
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('microphone=()');
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('geolocation=()');
  });
});

describe('CORS Protection', () => {
  it('should only allow configured origins', () => {
    // Test CORS configuration from @/server/config/cors
  });

  it('should reject requests from unauthorized origins', () => {
    // Test CORS rejection
  });
});
```

6. **Create sanitization.security.test.ts:**

```typescript
// tests/security/sanitization.security.test.ts
import { describe, it, expect } from 'bun:test';
import {
  sanitizeMetaTags,
  sanitizeHtml,
  validateImageUrl
} from '@/server/lib/sanitize';

describe('Input Sanitization', () => {
  describe('sanitizeMetaTags', () => {
    it('should strip HTML from meta title', () => {
      const result = sanitizeMetaTags({
        metaTitle: '<script>alert("xss")</script>Hello'
      });
      expect(result.metaTitle).toBe('Hello');
    });

    it('should enforce length limits', () => {
      const longTitle = 'A'.repeat(100);
      const result = sanitizeMetaTags({ metaTitle: longTitle });
      expect(result.metaTitle?.length).toBeLessThanOrEqual(60);
    });
  });

  describe('validateImageUrl', () => {
    it('should accept whitelisted CDN URLs', () => {
      expect(validateImageUrl('https://cdn.urlfy.cc/image.png')).not.toBeNull();
    });

    it('should reject non-HTTPS URLs', () => {
      expect(validateImageUrl('http://example.com/image.png')).toBeNull();
    });

    it('should reject non-whitelisted domains', () => {
      expect(validateImageUrl('https://evil.com/image.png')).toBeNull();
    });
  });
});
```

7. **Delete or archive original file after migration is complete:**
   - Verify all tests pass in new structure: `bun test tests/security/`
   - Remove `tests/security/security.test.ts`

---

### 3.2 Extract Worker Timing Constants

**Affected Files:**

- `src/server/workers/analytics.worker.ts`
- `src/server/workers/aggregation.worker.ts`
- `src/server/workers/cleanup.worker.ts`
- `src/server/workers/deletion.worker.ts`

**Target File:** `src/server/config/workers.ts`

**Action Items:**

1. **Create workers configuration:**

```typescript
// src/server/config/workers.ts

/**
 * Worker Configuration
 *
 * Centralized timing and configuration constants for background workers.
 * All durations are in milliseconds unless otherwise noted.
 */

export const WORKER_CONFIG = {
  /** Analytics worker settings */
  analytics: {
    /** Time to block processing of a stream message */
    blockDurationMs: 30_000,
    /** Garbage collection interval for stale claims */
    gcIntervalMs: 300_000,
    /** Maximum messages to process per batch */
    batchSize: 100,
    /** Consumer group name */
    consumerGroup: 'analytics-workers'
  },

  /** Aggregation worker settings */
  aggregation: {
    /** Interval between aggregation runs */
    intervalMs: 3_600_000, // 1 hour
    /** Time to retain raw analytics data (days) */
    retentionDays: 90
  },

  /** Cleanup worker settings */
  cleanup: {
    /** Interval between cleanup runs */
    intervalMs: 86_400_000, // 24 hours
    /** Soft-deleted links retention (days) */
    softDeleteRetentionDays: 30,
    /** Expired links grace period (days) */
    expiredGraceDays: 7
  },

  /** Deletion worker settings (GDPR/LGPD) */
  deletion: {
    /** Interval between deletion checks */
    intervalMs: 3_600_000, // 1 hour
    /** Legal deadline for processing requests (hours) */
    deadlineHours: 72
  },

  /** Common settings */
  common: {
    /** Default retry attempts */
    maxRetries: 3,
    /** Retry backoff base (ms) */
    retryBackoffMs: 1_000,
    /** Health check interval */
    healthCheckIntervalMs: 60_000
  }
} as const;

export type WorkerConfig = typeof WORKER_CONFIG;
```

2. **Update workers to use configuration:**

```typescript
// Example: src/server/workers/analytics.worker.ts
import { WORKER_CONFIG } from '@/server/config/workers';

const { blockDurationMs, gcIntervalMs, batchSize, consumerGroup } =
  WORKER_CONFIG.analytics;

// Use constants instead of magic numbers
await redis.xreadgroup(
  'GROUP',
  consumerGroup,
  consumerId,
  'BLOCK',
  blockDurationMs,
  'COUNT',
  batchSize,
  'STREAMS',
  streamKey,
  '>'
);
```

---

## Priority 4: Low (Backlog)

### 4.1 Run Dead Code Analysis

**Command:**

```bash
bunx knip
```

**Action Items:**

1. Add `knip` to devDependencies: `bun add -d knip`
2. Create `knip.config.ts`:

```typescript
// knip.config.ts
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/app/**/*.{ts,tsx}', 'src/server/**/*.ts'],
  project: ['src/**/*.{ts,tsx}'],
  ignore: [
    'src/db/scripts/**', // Seed scripts
    'tests/**' // Test files
  ],
  ignoreDependencies: [
    '@types/*' // Type definitions
  ]
};

export default config;
```

3. Add to CI as non-blocking check initially
4. Review and remove unused exports

### 4.2 Add Architecture Decision Records (ADRs)

**Target Directory:** `docs/adr/`

**Template:**

```markdown
# ADR-001: Use ElysiaJS Inside Next.js Route Handler

## Status

Accepted

## Context

We need a type-safe API framework that integrates with Next.js App Router.

## Decision

Mount ElysiaJS as catch-all route handler at `src/app/api/[[...slugs]]/route.ts`.

## Consequences

- ✅ Full TypeBox schema validation
- ✅ OpenAPI generation
- ✅ Type inference across routes
- ⚠️ Additional complexity in route handling
```

---

## Validation Checklist

After completing all tasks, verify:

- [ ] `bun run lint` passes without errors
- [ ] `bun run type-check` passes without errors
- [ ] `bun test` all tests pass
- [ ] `bun test tests/integration/` integration tests pass
- [ ] `bun test tests/security/` security tests pass
- [ ] GitHub Actions workflow runs successfully with proper secrets
- [ ] No `console.log` in production code paths (grep verification)
- [ ] All workers use constants from `WORKER_CONFIG`

---

## Implementation Order

1. **Day 1:** Priority 1 (GitHub Actions secrets) - Quick win, critical security
2. **Day 1-2:** Priority 2.1 (console.log migration) - Straightforward replacement
3. **Day 2-3:** Priority 2.2 (Integration tests) - Requires database setup
4. **Day 3-4:** Priority 3.1 (Split security tests) - Refactoring
5. **Day 4:** Priority 3.2 (Worker constants) - Simple extraction
6. **Backlog:** Priority 4 items - Schedule in future sprints
