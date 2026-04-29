/**
 * ═════════════════════════════════════════════════════════════════════
 * API KEY GUARD - Fail-closed behavior on DB write failure
 * ═════════════════════════════════════════════════════════════════════
 * Verifies that a database write failure during quota reservation
 * results in a 429 QUOTA_EXCEEDED response, not a pass-through.
 *
 * Covering plan step: Phase 1, item 3 — "fail-closed quota reservation"
 * Finding: CODEBASE_ANALYSIS_2026-04-25.md §Security – API-key quota
 * reservation fails open on database write failure.
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

// ─── Stable mock key fixtures ────────────────────────────────────────────────

/** SHA-256 of 'urlfy_sk_testkey12345678' — pre-computed so no actual crypto. */
const MOCK_KEY_HASH =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const MOCK_KEY_RECORD = {
  id: 'key-001',
  userId: 'user-001',
  keyHash: MOCK_KEY_HASH,
  prefix: 'urlfy_sk_',
  name: 'test-key',
  enabled: true,
  revokedAt: null,
  expiresAt: null,
  deletedAt: null,
  permissions: JSON.stringify(['links:read']),
  rateLimitEnabled: false,
  rateLimitMax: null,
  rateLimitTimeWindow: null,
  usageCount: 5,
  remaining: 10,
  requestCount: null,
  lastUsedAt: null
};

// ─── DB mock: SELECT succeeds, UPDATE throws ─────────────────────────────────

const updateMock = mock(async () => {
  throw new Error('deadlock detected');
});

const selectOneMock = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      limit: mock(async () => [MOCK_KEY_RECORD])
    }))
  }))
}));

const selectUpdateMock = mock(() => ({
  set: mock(() => ({
    where: mock(() => ({
      returning: updateMock
    }))
  }))
}));

const dbMock = {
  select: mock(() => selectOneMock()),
  update: mock(() => selectUpdateMock())
};

mock.module('@urlfy/data', () => ({
  db: dbMock,
  getDatabase: () => dbMock,
  initDatabase: async () => {}
}));

mock.module('@urlfy/data/schema/auth', () => ({
  apiKey: {
    id: 'id',
    keyHash: 'keyHash',
    enabled: 'enabled',
    deletedAt: 'deletedAt',
    revokedAt: 'revokedAt',
    expiresAt: 'expiresAt',
    rateLimitEnabled: 'rateLimitEnabled',
    rateLimitMax: 'rateLimitMax',
    rateLimitTimeWindow: 'rateLimitTimeWindow',
    usageCount: 'usageCount',
    lastUsedAt: 'lastUsedAt',
    remaining: 'remaining',
    permissions: 'permissions',
    userId: 'userId'
  }
}));

// ─── Rate limiter: always allow ──────────────────────────────────────────────

mock.module('@/server/lib/rate-limiter', () => ({
  rateLimiter: {
    checkLimit: mock(async () => ({
      allowed: true,
      remaining: 999,
      resetTime: Date.now() + 3600_000
    }))
  }
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  configureLogging: async () => {}
}));

// ─── crypto.subtle — compute real hash so header matches mock record ─────────

// We override the key hash in the mock to match what the guard will compute
// for our test header value. Since we can't easily pre-compute without running
// the actual SHA-256, we monkey-patch crypto.subtle.digest to return the known
// mock hash bytes.
const mockHashBytes = Buffer.from(MOCK_KEY_HASH, 'hex');

const originalDigest = globalThis.crypto?.subtle?.digest?.bind(
  globalThis.crypto.subtle
);
if (globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis.crypto.subtle, 'digest', {
    value: async (algorithm: string, _data: BufferSource) => {
      if (algorithm === 'SHA-256') {
        return mockHashBytes.buffer;
      }
      return originalDigest?.(algorithm, _data);
    },
    writable: true,
    configurable: true
  });
}

afterAll(() => {
  // Restore original crypto.subtle.digest
  if (originalDigest && globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis.crypto.subtle, 'digest', {
      value: originalDigest,
      writable: true,
      configurable: true
    });
  }
  mock.restore();
});

// ─── Build test app ──────────────────────────────────────────────────────────

async function buildGuardApp() {
  const { requireApiKey } = await import(
    `../../src/server/middleware/api-key.guard?fail-closed-test=${Date.now()}`
  );

  return new Elysia()
    .use(requireApiKey({ scopes: ['links:read' as never] }))
    .get('/test', () => ({ success: true, data: 'reached' }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api-key guard fail-closed quota reservation', () => {
  test('returns 429 QUOTA_EXCEEDED when DB write for quota reservation throws', async () => {
    const app = await buildGuardApp();

    const response = await app.handle(
      new Request('http://localhost/test', {
        headers: { 'x-api-key': 'urlfy_sk_testkey12345678' }
      })
    );

    // The guard must fail closed: DB write failure → QUOTA_EXCEEDED.
    // Both QUOTA_EXCEEDED and RATE_LIMITED use HTTP 429; the error code
    // in the body distinguishes them.
    expect(response.status).toBe(429);

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body.success).toBe(false);
    // Must be QUOTA_EXCEEDED (DB fail-closed), not RATE_LIMITED
    expect(body.error.code).toBe('QUOTA_EXCEEDED');

    // Confirm the UPDATE was attempted (not silently skipped)
    expect(updateMock).toHaveBeenCalled();
  });
});
