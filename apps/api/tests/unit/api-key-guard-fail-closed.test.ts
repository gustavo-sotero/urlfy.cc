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
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';
import { createDbMock } from '../mocks/db.mock';

const realRateLimiterModule = await import('@/server/lib/rate-limiter');
const realRateLimiter = realRateLimiterModule.rateLimiter;

// ─── Stable mock key fixtures ────────────────────────────────────────────────

/** Real SHA-256 of 'urlfy_sk_testkey12345678'. */
const MOCK_KEY_HASH =
  'aeb2ca2a849c5caaf554d02b86b69f3b317889faec20c305522f905271be9837';

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
  ...createDbMock(),
  select: mock(() => selectOneMock()),
  update: mock(() => selectUpdateMock())
};

mock.module('@urlfy/data', () => ({
  db: dbMock,
  checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 1 }),
  getDatabase: () => dbMock,
  getSqlConnection: () => ({}),
  closeDatabase: async () => undefined,
  initDatabase: async () => {}
}));

// ─── Rate limiter: always allow ──────────────────────────────────────────────

mock.module('@/server/lib/rate-limiter', () => ({
  ...realRateLimiterModule,
  rateLimiter: Object.assign(
    Object.create(Object.getPrototypeOf(realRateLimiter)),
    realRateLimiter,
    {
      checkLimit: mock(async () => ({
        allowed: true,
        remaining: 999,
        resetTime: Date.now() + 3600_000
      }))
    }
  )
}));

mock.module('@/server/lib/telemetry', () =>
  createTelemetryModuleMock({
    createLogger: () => ({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    })
  })
);

afterAll(() => {
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
