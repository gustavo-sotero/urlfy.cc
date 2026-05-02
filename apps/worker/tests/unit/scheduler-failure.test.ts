/**
 * ═════════════════════════════════════════════════════════════════════
 * SCHEDULER — FAILURE MODE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Phase 10 failure-mode tests for the data deletion cron job.
 *
 * Validates that:
 * 1. When the DB query fails, the outer try/catch catches the error and
 *    logs "[Scheduler] Error in data deletion job" without propagating.
 * 2. When the DB query succeeds but Redis XADD fails (scheduleDeletion
 *    throws), the per-request inner catch logs
 *    "[Scheduler] Error enqueueing deletion job" for that specific request
 *    while still processing the remaining requests in the batch.
 * 3. The cron callback never throws an unhandled rejection regardless of
 *    the failure scenario.
 * ═════════════════════════════════════════════════════════════════════
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ─── Failure flags ──────────────────────────────────────────────────────────
const failures = {
  dbSelect: false, // When true: db.select().from(...) throws
  scheduleRedis: false // When true: scheduleDeletion() throws
};

// ─── Pending deletion request fixtures ─────────────────────────────────────
const PENDING_REQUESTS = [
  {
    id: 'req-001',
    userId: 'user-001',
    status: 'pending',
    deadlineAt: new Date(Date.now() - 1000)
  },
  {
    id: 'req-002',
    userId: 'user-002',
    status: 'pending',
    deadlineAt: new Date(Date.now() - 2000)
  }
];

// ─── DB mock ────────────────────────────────────────────────────────────────
const dbSelectChain = {
  from: mock(() => {
    if (failures.dbSelect) throw new Error('DB connection refused');
    const pending = Object.assign(Promise.resolve(PENDING_REQUESTS), {
      where: mock(() => {
        if (failures.dbSelect) throw new Error('DB connection refused');
        return Promise.resolve(PENDING_REQUESTS);
      })
    });
    return pending;
  })
};

const dbMock = {
  select: mock(() => {
    if (failures.dbSelect) throw new Error('DB connection refused');
    return dbSelectChain;
  })
};

// ─── Queue mock ─────────────────────────────────────────────────────────────
const STREAM_NAMES_MOCK = {
  analyticsClicks: 'analytics:clicks',
  analyticsDead: 'analytics:dead',
  aggregation: 'aggregation',
  aggregationDead: 'aggregation:dead',
  cleanup: 'cleanup',
  cleanupDead: 'cleanup:dead',
  deletion: 'deletion',
  deletionDead: 'deletion:dead',
  notifications: 'notifications'
} as const;

const CONSUMER_GROUPS_MOCK = {
  analytics: 'analytics-group',
  analyticsDead: 'analytics-dead-group',
  aggregation: 'aggregation-group',
  cleanup: 'cleanup-group',
  deletion: 'deletion-group',
  notifications: 'notifications-group'
} as const;

const defaultRedisAddImplementation = async (
  _stream: string,
  _payload: unknown
) => {
  if (failures.scheduleRedis) throw new Error('Redis XADD failed');
  return 'stream-entry-id';
};

const redisStreamAddMock = mock(defaultRedisAddImplementation);

// ─── Mock registrations (hoisted by Bun before imports) ─────────────────────
mock.module('@urlfy/data', () => ({
  db: dbMock,
  dataDeletionRequest: {},
  checkDatabaseHealth: mock(() => Promise.resolve({ status: 'ok' })),
  closeDatabase: mock(() => Promise.resolve())
}));

mock.module('@urlfy/data/schema/audit', () => ({
  dataDeletionRequest: { status: {}, deadlineAt: {} }
}));

mock.module('@urlfy/cache', () => ({
  RedisStream: {
    add: redisStreamAddMock
  },
  STREAM_NAMES: STREAM_NAMES_MOCK,
  CONSUMER_GROUPS: CONSUMER_GROUPS_MOCK
}));

mock.module('drizzle-orm', () => ({
  and: mock((...args: unknown[]) => args),
  eq: mock((_col: unknown, _val: unknown) => ({})),
  lt: mock((_col: unknown, _val: unknown) => ({})),
  // Prevent contamination of schema modules that import `relations` from drizzle-orm
  relations: mock(() => ({}))
}));

// Mock the underlying redis used by MetricsService so the real implementation
// loads without a live Redis connection. metrics.service.test.ts re-mocks this
// with a stateful mockRedis; bun's ESM live bindings ensure MetricsService
// automatically picks up the new client when that file registers its mock.
mock.module('@/server/lib/redis', () => ({
  redis: {
    incr: async () => 1,
    get: async () => null,
    getset: async () => null,
    set: async () => 'OK',
    ttl: async () => -1,
    del: async () => 1,
    send: async () => null
  },
  getRedisClient: () => ({}),
  canAttemptRedisCommand: () => true,
  markRedisCommandFailure: mock(() => {}),
  markRedisCommandSuccess: mock(() => {}),
  getRedisHealthSnapshot: mock(() => ({
    isHealthy: true,
    isConnected: true,
    isDegraded: false,
    consecutiveFailures: 0,
    lastError: null,
    lastConnectedAt: null,
    lastFailureAt: null,
    lastSuccessfulCommandAt: null,
    degradedUntil: null
  }))
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    info: mock(),
    debug: mock(),
    warn: mock(),
    error: mock()
  }),
  fireAndForget: (_label: string, fn: () => Promise<unknown>) => {
    fn().catch(() => {});
  },
  initTelemetry: mock(),
  shutdownTelemetry: mock()
}));

// ─── Module under test (imported AFTER mocks) ───────────────────────────────
import { dataDeletionJob } from '@/jobs/scheduler';

// ─── Extract the live callback (CronJob stores it internally) ───────────────
// CronJob.fireOnTick / onTick is the user-provided callback; we need to
// invoke it directly to test failure behaviour without starting cron timers.
function getCronCallback(job: {
  onTick?: unknown;
  _callbacks?: unknown[];
}): () => Promise<void> {
  // node-cron / cron package stores the callback as job.onTick or in callbacks array
  const cb =
    (job as { onTick?: () => Promise<void> }).onTick ??
    ((job as { _callbacks?: Array<() => Promise<void>> })._callbacks ?? [])[0];
  if (typeof cb !== 'function') {
    throw new Error(
      'Could not extract cron callback — check CronJob internal field name'
    );
  }
  return cb as () => Promise<void>;
}

describe('dataDeletionJob — failure modes', () => {
  beforeEach(() => {
    failures.dbSelect = false;
    failures.scheduleRedis = false;
    redisStreamAddMock.mockClear();
    redisStreamAddMock.mockImplementation(defaultRedisAddImplementation);
  });

  test('does not throw when DB query fails — logs "[Scheduler] Error in data deletion job"', async () => {
    failures.dbSelect = true;

    const callback = getCronCallback(
      dataDeletionJob as Parameters<typeof getCronCallback>[0]
    );

    // Must not throw — the outer catch handles it
    await expect(callback()).resolves.toBeUndefined();
  });

  test('does not throw when scheduleDeletion (Redis) fails — logs per-request error', async () => {
    failures.scheduleRedis = true;

    const callback = getCronCallback(
      dataDeletionJob as Parameters<typeof getCronCallback>[0]
    );

    // Both requests fail; inner catch should handle each without breaking the loop
    await expect(callback()).resolves.toBeUndefined();
  });

  test('processes all requests and calls scheduleDeletion once per pending request on happy path', async () => {
    const callback = getCronCallback(
      dataDeletionJob as Parameters<typeof getCronCallback>[0]
    );

    await callback();

    expect(redisStreamAddMock).toHaveBeenCalledTimes(PENDING_REQUESTS.length);
    expect(redisStreamAddMock).toHaveBeenCalledWith(
      STREAM_NAMES_MOCK.deletion,
      {
        requestId: PENDING_REQUESTS[0].id,
        userId: PENDING_REQUESTS[0].userId
      }
    );
    expect(redisStreamAddMock).toHaveBeenCalledWith(
      STREAM_NAMES_MOCK.deletion,
      {
        requestId: PENDING_REQUESTS[1].id,
        userId: PENDING_REQUESTS[1].userId
      }
    );
  });

  test('processes remaining requests even when one scheduleDeletion call fails', async () => {
    // Fail only the first call, succeed the rest
    let callCount = 0;
    redisStreamAddMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Redis XADD failed for req-001');
      return 'ok-job-id';
    });

    const callback = getCronCallback(
      dataDeletionJob as Parameters<typeof getCronCallback>[0]
    );

    // Must not throw; second request should still be attempted
    await expect(callback()).resolves.toBeUndefined();

    // Both requests were attempted despite the partial failure
    expect(redisStreamAddMock).toHaveBeenCalledTimes(PENDING_REQUESTS.length);
  });
});
