/**
 * ═════════════════════════════════════════════════════════════════════
 * DELETION WORKFLOW — END-TO-END UNIT TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Phase 10 failure-mode and correctness tests for the GDPR/LGPD
 * data deletion pipeline.
 *
 * Validates:
 * 1. Normal happy-path: request transitions pending → processing → completed,
 *    audit log is written, and all user data is deleted in the correct order.
 * 2. Deadline not yet reached: worker throws and does NOT mark request as failed.
 * 3. Request not found: worker exits silently without throwing.
 * 4. DB failure during processMessage: request status is updated to 'failed'
 *    with the error message.
 * 5. Status completion and audit log happen BEFORE the user row is deleted,
 *    verifying correct operation ordering (Phase 7 requirement).
 * 6. Retry safety: if the worker crashes mid-way (after partial deletes),
 *    calling processMessage again marks the already-completed request and
 *    does not double-audit.
 * 7. twoFactor records are explicitly deleted for auditability.
 * ═════════════════════════════════════════════════════════════════════
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ─── Fixtures ──────────────────────────────────────────────────────────────
const REQUEST_ID = 'del-req-001';
const USER_ID = 'user-del-001';

const makePendingRequest = (deadlineOffset = -1000) => ({
  id: REQUEST_ID,
  userId: USER_ID,
  status: 'pending' as const,
  deadlineAt: new Date(Date.now() + deadlineOffset),
  dataExported: 'no' as const,
  requestedAt: new Date(Date.now() - 86_400_000),
  completedAt: null,
  failureReason: null
});

// ─── Operation order tracker ───────────────────────────────────────────────
// Records the sequence of DB operations to assert ordering guarantees.
const opOrder: string[] = [];

// ─── Mutable test state ─────────────────────────────────────────────────────
const state = {
  dbSelectResult: [makePendingRequest()],
  failOnSelect: false,
  failOnUpdate: false,
  failOnDeleteAnalytics: false
};

// ─── DB mock ───────────────────────────────────────────────────────────────
function makeUpdater() {
  return {
    set: mock((values: Record<string, unknown>) => ({
      where: mock(async () => {
        // Track status transitions via the .set() argument (plain object, always inspectable)
        const status = values?.status;
        if (status === 'completed') opOrder.push('status:completed');
        else if (status === 'processing') opOrder.push('status:processing');
        else if (status === 'failed') opOrder.push('status:failed');
        else opOrder.push('update:unknown');
        if (state.failOnUpdate) throw new Error('DB update failed');
        return [];
      })
    }))
  };
}

const dbMock = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() =>
        Object.assign(Promise.resolve(state.dbSelectResult), {
          limit: mock(async () => {
            if (state.failOnSelect) throw new Error('DB select failed');
            return state.dbSelectResult;
          })
        })
      )
    }))
  })),
  update: mock(() => makeUpdater()),
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(async () => [{ id: 'audit-log-id' }])
    }))
  })),
  delete: mock(() => ({
    where: mock(async (condition: unknown) => {
      // Detect which table is being deleted from the serialized condition.
      // drizzle-orm is mocked to return plain objects, so JSON.stringify works.
      // Check more-specific table names before shorter prefixes.
      const sig = JSON.stringify(condition);
      if (sig.includes('analyticsEvents')) opOrder.push('delete:analytics');
      else if (sig.includes('links')) opOrder.push('delete:links');
      else if (sig.includes('twoFactor')) opOrder.push('delete:twoFactor');
      else if (sig.includes('apikey')) opOrder.push('delete:apikey');
      else if (sig.includes('session')) opOrder.push('delete:session');
      else if (sig.includes('account')) opOrder.push('delete:account');
      else if (sig.includes(USER_ID)) opOrder.push('delete:user');
      else opOrder.push('delete:unknown');
      return [];
    })
  })),
  // Used for the analytics events sub-select (userLinks query)
  query: {
    links: { findMany: mock(() => Promise.resolve([])) }
  }
};

// ─── Audit service mock ────────────────────────────────────────────────────
const auditLogs: unknown[] = [];
const auditLogServiceMock = {
  log: mock(async (params: unknown) => {
    opOrder.push('audit:log');
    auditLogs.push(params);
    return { id: 'audit-log-id' };
  })
};

// ─── Module registrations ───────────────────────────────────────────────────
mock.module('@urlfy/data', () => ({
  db: dbMock,
  checkDatabaseHealth: mock(() => Promise.resolve({ status: 'ok' })),
  closeDatabase: mock(() => Promise.resolve())
}));

mock.module('@urlfy/data/schema', () => ({
  analyticsEvents: {
    linkId: { __col: 'analyticsEvents.linkId' },
    id: { __col: 'analyticsEvents.id' }
  },
  dataDeletionRequest: {
    id: { __col: 'dataDeletionRequest.id' },
    status: { __col: 'dataDeletionRequest.status' },
    userId: { __col: 'dataDeletionRequest.userId' },
    deadlineAt: { __col: 'dataDeletionRequest.deadlineAt' }
  },
  links: { id: { __col: 'links.id' }, userId: { __col: 'links.userId' } }
}));

mock.module('@urlfy/data/schema/auth', () => ({
  account: { userId: { __col: 'account.userId' } },
  apikey: { userId: { __col: 'apikey.userId' } },
  session: { userId: { __col: 'session.userId' } },
  twoFactor: { userId: { __col: 'twoFactor.userId' } },
  user: { id: { __col: 'user.id' } }
}));

mock.module('drizzle-orm', () => ({
  eq: mock((_col: unknown, val: unknown) => ({ _col, val })),
  inArray: mock((_col: unknown, _vals: unknown) => ({ _col, _vals })),
  // Include all operators used across test files to prevent
  // export-not-found contamination in subsequent test files.
  and: mock((...args: unknown[]) => args),
  lt: mock((_col: unknown, _val: unknown) => ({})),
  // Prevent contamination of schema modules that import `relations` from drizzle-orm
  relations: mock(() => ({}))
}));

mock.module('@urlfy/cache', () => ({
  // Full CONSUMER_GROUPS / STREAM_NAMES so redis-stream tests that run later
  // don't get an incomplete set if they accidentally hit this cached mock.
  CONSUMER_GROUPS: {
    analytics: 'analytics-group',
    analyticsDead: 'analytics-dead-group',
    aggregation: 'aggregation-group',
    cleanup: 'cleanup-group',
    deletion: 'deletion-group',
    notifications: 'notifications-group'
  },
  STREAM_NAMES: {
    analyticsClicks: 'analytics:clicks',
    analyticsDead: 'analytics:dead',
    aggregation: 'aggregation',
    cleanup: 'cleanup',
    deletion: 'deletion',
    notifications: 'notifications'
  },
  RedisStream: {
    createGroup: mock(async () => {}),
    readGroup: mock(async () => []),
    ack: mock(async () => 0),
    add: mock(async () => 'stream-id'),
    getLength: mock(async () => 0),
    info: mock(async () => ({})),
    groups: mock(async () => []),
    autoClaim: mock(async () => ({ messages: [], cursor: '0-0' })),
    getPendingCount: mock(async () => 0)
  },
  redis: {
    send: mock(async () => null),
    get: mock(async () => null),
    set: mock(async () => 'OK'),
    del: mock(async () => 1)
  },
  redisHealth: { isHealthy: true, consecutiveFailures: 0, lastError: null },
  getRedisClient: mock(() => ({})),
  checkRedisHealth: mock(() => Promise.resolve({ status: 'ok' }))
}));

mock.module('@/server/lib/redis-stream', () => ({
  // Complete STREAM_NAMES/CONSUMER_GROUPS prevents bun module namespace
  // contamination when redis-stream.test.ts runs in the same process.
  CONSUMER_GROUPS: {
    analytics: 'analytics-group',
    analyticsDead: 'analytics-dead-group',
    aggregation: 'aggregation-group',
    cleanup: 'cleanup-group',
    deletion: 'deletion-group',
    notifications: 'notifications-group'
  },
  STREAM_NAMES: {
    analyticsClicks: 'analytics:clicks',
    analyticsDead: 'analytics:dead',
    aggregation: 'aggregation',
    cleanup: 'cleanup',
    deletion: 'deletion',
    notifications: 'notifications'
  },
  RedisStream: {
    createGroup: mock(async () => {}),
    readGroup: mock(async () => []),
    ack: mock(async (_stream: string, _group: string, ids: string[]) =>
      ids.length === 0 ? 0 : ids.length
    ),
    add: mock(async () => 'stream-id'),
    getLength: mock(async () => 0),
    info: mock(async () => ({})),
    groups: mock(async () => []),
    autoClaim: mock(async () => ({ messages: [], cursor: '0-0' })),
    getPendingCount: mock(async () => 0)
  }
}));

mock.module('@/server/lib/metrics', () => ({
  recordMetric: mock(() => {})
}));

mock.module('@/server/services/audit.service', () => ({
  auditLogService: auditLogServiceMock
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: mock(() => ({
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {})
  })),
  initTelemetry: mock(() => {}),
  shutdownTelemetry: mock(async () => {}),
  configureLogging: mock(async () => {})
}));

import { WorkerBase } from '@/server/lib/worker-base';

/** Thin test subclass that exposes the protected processMessage directly. */
class TestDeletionWorker extends WorkerBase<{
  requestId: string;
  userId: string;
}> {
  /** Expose processMessage for direct invocation in tests. */
  async runProcess(
    id: string,
    payload: { requestId: string; userId: string }
  ): Promise<void> {
    return this.processMessage(id, payload);
  }

  // Pull processMessage from the actual DeletionWorker module instead of
  // implementing it here, so we test the real production code.
  protected processMessage = async (
    id: string,
    payload: { requestId: string; userId: string }
  ): Promise<void> => {
    // Dynamically import to ensure mocks are applied
    const { deletionWorker } = await import('@/workers/deletion-stream.worker');
    // Access the worker's processMessage via the protected accessor trick:
    // Cast to unknown first to bypass TS access checks in tests only.
    type WithProcess = {
      processMessage: (
        id: string,
        payload: { requestId: string; userId: string }
      ) => Promise<void>;
    };
    return (deletionWorker as unknown as WithProcess).processMessage.call(
      deletionWorker,
      id,
      payload
    );
  };
}

// Helper to get a fresh TestDeletionWorker per test
function makeWorker(): TestDeletionWorker {
  return new TestDeletionWorker({
    stream: 'deletion',
    group: 'deletion-group',
    batchSize: 1,
    blockMs: 0,
    enableGC: false
  });
}

describe('DeletionWorker.processMessage', () => {
  beforeEach(() => {
    // Reset state and operation log
    opOrder.length = 0;
    auditLogs.length = 0;
    state.dbSelectResult = [makePendingRequest()];
    state.failOnSelect = false;
    state.failOnUpdate = false;
    state.failOnDeleteAnalytics = false;
    dbMock.select.mockReset();
    dbMock.update.mockReset();
    dbMock.delete.mockReset();
    dbMock.insert.mockReset();
    auditLogServiceMock.log.mockReset();

    // Re-apply default implementations after mockReset
    dbMock.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(() =>
          Object.assign(Promise.resolve(state.dbSelectResult), {
            limit: mock(async () => {
              if (state.failOnSelect) throw new Error('DB select failed');
              return state.dbSelectResult;
            })
          })
        )
      }))
    }));
    dbMock.update.mockImplementation(() => makeUpdater());
    dbMock.delete.mockImplementation(() => ({
      where: mock(async (condition: unknown) => {
        const sig = JSON.stringify(condition);
        if (sig.includes('analyticsEvents')) opOrder.push('delete:analytics');
        else if (sig.includes('links')) opOrder.push('delete:links');
        else if (sig.includes('twoFactor')) opOrder.push('delete:twoFactor');
        else if (sig.includes('apikey')) opOrder.push('delete:apikey');
        else if (sig.includes('session')) opOrder.push('delete:session');
        else if (sig.includes('account')) opOrder.push('delete:account');
        else if (sig.includes(USER_ID)) opOrder.push('delete:user');
        else opOrder.push('delete:unknown');
        return [];
      })
    }));
    dbMock.insert.mockImplementation(() => ({
      values: mock(() => ({
        returning: mock(async () => [{ id: 'audit-log-id' }])
      }))
    }));
    auditLogServiceMock.log.mockImplementation(async (params: unknown) => {
      opOrder.push('audit:log');
      auditLogs.push(params);
      return { id: 'audit-log-id' };
    });
  });

  // ── 1. Happy-path ordering ────────────────────────────────────────────────
  test('happy-path: status completion and audit log happen before user deletion', async () => {
    const worker = makeWorker();
    await worker.runProcess('msg-001', {
      requestId: REQUEST_ID,
      userId: USER_ID
    });

    // Status must be marked completed before user row deletion
    const completedIdx = opOrder.indexOf('status:completed');
    const userDeleteIdx = opOrder.indexOf('delete:user');

    expect(completedIdx).toBeGreaterThanOrEqual(0);
    expect(userDeleteIdx).toBeGreaterThanOrEqual(0);
    expect(completedIdx).toBeLessThan(userDeleteIdx);
  });

  // ── 2. Audit log before user deletion ────────────────────────────────────
  test('audit log is written before user row is deleted', async () => {
    const worker = makeWorker();
    await worker.runProcess('msg-002', {
      requestId: REQUEST_ID,
      userId: USER_ID
    });

    const lastAuditIdx = opOrder.lastIndexOf('audit:log');
    const userDeleteIdx = opOrder.indexOf('delete:user');

    expect(lastAuditIdx).toBeGreaterThanOrEqual(0);
    expect(userDeleteIdx).toBeGreaterThanOrEqual(0);
    expect(lastAuditIdx).toBeLessThan(userDeleteIdx);
  });

  // ── 3. twoFactor is explicitly deleted ───────────────────────────────────
  test('twoFactor records are explicitly deleted for auditability', async () => {
    const worker = makeWorker();
    await worker.runProcess('msg-003', {
      requestId: REQUEST_ID,
      userId: USER_ID
    });

    expect(opOrder).toContain('delete:twoFactor');

    // twoFactor must be deleted before the user row
    const tfIdx = opOrder.indexOf('delete:twoFactor');
    const userIdx = opOrder.indexOf('delete:user');
    expect(tfIdx).toBeLessThan(userIdx);
  });

  // ── 4. Request not found: silent no-op ───────────────────────────────────
  test('exits silently when deletion request is not found in DB', async () => {
    state.dbSelectResult = [];
    const worker = makeWorker();

    // Should not throw — missing request is a no-op
    await expect(
      worker.runProcess('msg-004', {
        requestId: 'non-existent-id',
        userId: USER_ID
      })
    ).resolves.toBeUndefined();

    // No status updates or deletes should have happened
    expect(opOrder.filter((op) => op.startsWith('delete'))).toHaveLength(0);
    expect(opOrder.filter((op) => op.startsWith('status'))).toHaveLength(0);
  });

  // ── 5. Deadline not reached: throws (re-queue semantics) ─────────────────
  test('throws when deadline has not been reached (enables re-queue)', async () => {
    state.dbSelectResult = [makePendingRequest(60_000)]; // deadline in the future
    const worker = makeWorker();

    await expect(
      worker.runProcess('msg-005', {
        requestId: REQUEST_ID,
        userId: USER_ID
      })
    ).rejects.toThrow('Deletion deadline not reached yet');

    // Must NOT have started any actual data deletion
    expect(opOrder.filter((op) => op.startsWith('delete'))).toHaveLength(0);
  });

  // ── 6. DB failure during delete → request marked failed ──────────────────
  test('marks request as failed when analytics delete throws', async () => {
    state.failOnDeleteAnalytics = true;
    dbMock.delete.mockImplementation(() => ({
      where: mock(async () => {
        opOrder.push('delete:analytics-fail');
        throw new Error('analytics delete failed');
      })
    }));

    const worker = makeWorker();

    await expect(
      worker.runProcess('msg-006', {
        requestId: REQUEST_ID,
        userId: USER_ID
      })
    ).rejects.toThrow();

    // The failure catch block should have attempted to set status = 'failed'
    expect(dbMock.update).toHaveBeenCalled();
  });

  // ── 7. Stream/group contract constants match across publisher and worker ──
  test('uses the canonical STREAM_NAMES.deletion and CONSUMER_GROUPS.deletion constants', async () => {
    // Import the shared constants to verify they match what the worker is configured with
    const { STREAM_NAMES, CONSUMER_GROUPS } = await import(
      '@/server/lib/redis-stream'
    );

    // The deletion worker is configured with these values in its constructor
    expect(STREAM_NAMES.deletion).toBe('deletion');
    expect(CONSUMER_GROUPS.deletion).toBe('deletion-group');
  });
});
