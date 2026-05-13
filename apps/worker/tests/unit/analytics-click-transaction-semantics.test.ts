import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realDrizzle from 'drizzle-orm';

const realDataSchema = await import(
  '../../../../packages/data/src/schema.ts?worker-analytics-click-tx-real-schema'
);

const realCacheModule = await import(
  '../../../../packages/cache/src/index.ts?worker-analytics-click-tx-real-cache'
);

type ClickEventStream = {
  eventId?: string;
  linkId: string;
  shortCode: string;
  visitorHash: string;
  country: string;
  city: string;
  latitude: string;
  longitude: string;
  userAgent: string;
  referer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  timestamp: string;
};

type TransactionRow = {
  linkId: string;
  streamMessageId: string;
};

type LinkCounterUpdate = {
  clicksDelta: number;
  lastClickedAt: Date;
  linkId: string;
};

const baseEvent: ClickEventStream = {
  linkId: 'link-001',
  shortCode: 'urlfy',
  visitorHash: 'visitor-hash',
  country: 'BR',
  city: 'Sao Paulo',
  latitude: '',
  longitude: '',
  userAgent: 'Mozilla/5.0',
  referer: 'https://example.com/post',
  timestamp: '2026-05-07T12:00:00.000Z'
};

const state = {
  cacheCalls: [] as Array<{ count?: number; shortCode: string }>,
  committedRows: [] as TransactionRow[],
  committedUpdates: [] as LinkCounterUpdate[],
  drainCalls: [] as Array<{ count?: number; linkId: string }>,
  failCacheIncrement: false,
  failDrainPending: false,
  failLinkUpdate: false,
  rollbackCount: 0
};

function resetState(): void {
  state.cacheCalls = [];
  state.committedRows = [];
  state.committedUpdates = [];
  state.drainCalls = [];
  state.failCacheIncrement = false;
  state.failDrainPending = false;
  state.failLinkUpdate = false;
  state.rollbackCount = 0;
}

function extractClicksDelta(expression: unknown): number {
  const values =
    expression && typeof expression === 'object' && 'values' in expression
      ? (expression as { values?: unknown[] }).values
      : undefined;

  const numericValue = values?.find(
    (value): value is number => typeof value === 'number'
  );

  return numericValue ?? 1;
}

function createTransactionContext() {
  const stagedRows: TransactionRow[] = [];
  const stagedUpdates: LinkCounterUpdate[] = [];

  return {
    stagedRows,
    stagedUpdates,
    tx: {
      insert: mock(() => ({
        values: mock(
          (values: Record<string, unknown> | Record<string, unknown>[]) => ({
            onConflictDoNothing: mock(() => ({
              returning: mock(async () => {
                const rows = Array.isArray(values) ? values : [values];
                const existingStreamIds = new Set(
                  [...state.committedRows, ...stagedRows].map(
                    (row) => row.streamMessageId
                  )
                );
                const insertedRows: Array<{
                  id: string;
                  linkId: string;
                  streamMessageId: string;
                }> = [];

                for (const row of rows) {
                  const streamMessageId = String(row.streamMessageId ?? '');
                  const linkId = String(row.linkId ?? '');

                  if (
                    !streamMessageId ||
                    existingStreamIds.has(streamMessageId)
                  ) {
                    continue;
                  }

                  existingStreamIds.add(streamMessageId);
                  stagedRows.push({ linkId, streamMessageId });
                  insertedRows.push({
                    id: `row-${streamMessageId}`,
                    linkId,
                    streamMessageId
                  });
                }

                return insertedRows;
              })
            }))
          })
        )
      })),
      update: mock(() => ({
        set: mock((values: Record<string, unknown>) => ({
          where: mock(async (condition: unknown) => {
            if (state.failLinkUpdate) {
              throw new Error('link update failed');
            }

            const linkId =
              condition && typeof condition === 'object' && 'val' in condition
                ? String((condition as { val: unknown }).val)
                : 'unknown';

            stagedUpdates.push({
              linkId,
              clicksDelta: extractClicksDelta(values.clicksCount),
              lastClickedAt: values.lastClickedAt as Date
            });

            return [];
          })
        }))
      }))
    }
  };
}

const dbMock = {
  insert: mock(() => {
    throw new Error(
      'analytics-click worker should use db.transaction for inserts'
    );
  }),
  transaction: mock(async <T>(callback: (tx: unknown) => Promise<T>) => {
    const { tx, stagedRows, stagedUpdates } = createTransactionContext();

    try {
      const result = await callback(tx);
      state.committedRows.push(...stagedRows);
      state.committedUpdates.push(...stagedUpdates);
      return result;
    } catch (error) {
      state.rollbackCount++;
      throw error;
    }
  }),
  update: mock(() => {
    throw new Error(
      'analytics-click worker should use db.transaction for updates'
    );
  })
};

const cacheServiceMock = {
  incrementClicksCount: mock(async (shortCode: string, count?: number) => {
    state.cacheCalls.push({ shortCode, count });

    if (state.failCacheIncrement) {
      throw new Error('cache increment failed');
    }

    return 1;
  })
};

const drainPendingClicksMock = mock(async (linkId: string, count?: number) => {
  state.drainCalls.push({ linkId, count });

  if (state.failDrainPending) {
    throw new Error('pending drain failed');
  }

  return 0;
});

const redisClientMock = {
  del: mock(async () => 1),
  send: mock(async () => [])
};

mock.module('@urlfy/data/schema', () => ({
  ...realDataSchema,
  analyticsEvents: {
    ...realDataSchema.analyticsEvents,
    id: { __col: 'analyticsEvents.id' },
    linkId: { __col: 'analyticsEvents.linkId' },
    streamMessageId: { __col: 'analyticsEvents.streamMessageId' }
  },
  links: {
    ...realDataSchema.links,
    clicksCount: { __col: 'links.clicksCount' },
    id: { __col: 'links.id' },
    lastClickedAt: { __col: 'links.lastClickedAt' }
  }
}));

mock.module('@urlfy/data', () => ({
  db: dbMock,
  checkDatabaseHealth: mock(() => Promise.resolve({ status: 'ok' })),
  closeDatabase: mock(() => Promise.resolve())
}));

mock.module('drizzle-orm', () => ({
  ...realDrizzle,
  eq: mock((_col: unknown, val: unknown) => ({ val })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values
    }),
    { raw: realDrizzle.sql.raw }
  )
}));

mock.module('@urlfy/cache', () => ({
  ...realCacheModule,
  CACHE_KEYS: {
    ...realCacheModule.CACHE_KEYS,
    ANALYTICS_KEYS_SET: (linkId: string) => `analytics:keys:${linkId}`
  },
  CACHE_TTL: realCacheModule.CACHE_TTL,
  drainPendingClicks: drainPendingClicksMock
}));

mock.module('@/server/lib/metrics', () => ({
  recordMetric: mock(() => {})
}));

mock.module('@/server/lib/redis', () => ({
  getRedisClient: mock(() => redisClientMock)
}));

mock.module('@/server/lib/redis-stream', () => ({
  CONSUMER_GROUPS: {
    analytics: 'analytics-group'
  },
  RedisStream: {
    ack: mock(async () => 0),
    autoClaim: mock(async () => ({ cursor: '0-0', messages: [] })),
    createGroup: mock(async () => {}),
    readGroup: mock(async () => [])
  },
  STREAM_NAMES: {
    analyticsClicks: 'analytics:clicks',
    analyticsDead: 'analytics:dead'
  }
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: mock(() => ({
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {})
  }))
}));

mock.module('@/server/services/cache.service', () => ({
  cacheService: cacheServiceMock
}));

mock.module('@/server/services/useragent.service', () => ({
  parseUserAgent: mock(() => ({
    browser: 'Chrome',
    browserVersion: '136.0.0.0',
    deviceType: 'desktop',
    isBot: false,
    os: 'macOS',
    osVersion: '14'
  }))
}));

async function loadWorkerModule() {
  return import('../../src/workers/analytics-click.worker');
}

function getWorkerAccess(
  workerModule: Awaited<ReturnType<typeof loadWorkerModule>>
) {
  return workerModule.analyticsClickWorker as unknown as {
    processMessage: (id: string, payload: ClickEventStream) => Promise<void>;
    processMessages: (
      messages: Array<{ data: ClickEventStream; id: string }>
    ) => Promise<{
      failedMessages: Array<{ data: ClickEventStream; id: string }>;
      processedIds: string[];
    }>;
  };
}

describe('analytics-click worker transactional semantics', () => {
  beforeEach(() => {
    resetState();
    cacheServiceMock.incrementClicksCount.mockClear();
    dbMock.insert.mockClear();
    dbMock.transaction.mockClear();
    dbMock.update.mockClear();
    drainPendingClicksMock.mockClear();
    redisClientMock.del.mockClear();
    redisClientMock.send.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test('rolls back the mandatory DB stage when the link counter update fails', async () => {
    state.failLinkUpdate = true;

    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    await expect(worker.processMessage('msg-1', baseEvent)).rejects.toThrow(
      'link update failed'
    );

    expect(state.rollbackCount).toBe(1);
    expect(state.committedRows).toHaveLength(0);
    expect(state.committedUpdates).toHaveLength(0);
    expect(state.cacheCalls).toHaveLength(0);
    expect(state.drainCalls).toHaveLength(0);
  });

  test('treats post-commit reconciliation failures as best-effort for a single message', async () => {
    state.failCacheIncrement = true;

    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    await expect(
      worker.processMessage('msg-2', baseEvent)
    ).resolves.toBeUndefined();

    expect(state.rollbackCount).toBe(0);
    expect(state.committedRows).toEqual([
      { linkId: 'link-001', streamMessageId: 'msg-2' }
    ]);
    expect(state.committedUpdates).toHaveLength(1);
    expect(state.cacheCalls).toEqual([{ count: 1, shortCode: 'urlfy' }]);
    expect(state.drainCalls).toEqual([{ count: 1, linkId: 'link-001' }]);
  });

  test('uses payload eventId as the durable dedupe identity across requeues', async () => {
    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    await expect(
      worker.processMessage('redis-msg-1', {
        ...baseEvent,
        eventId: 'event-stable-1'
      })
    ).resolves.toBeUndefined();

    await expect(
      worker.processMessage('redis-msg-2', {
        ...baseEvent,
        eventId: 'event-stable-1'
      })
    ).resolves.toBeUndefined();

    expect(state.committedRows).toEqual([
      { linkId: 'link-001', streamMessageId: 'event-stable-1' }
    ]);
    expect(state.committedUpdates).toHaveLength(1);
  });

  test('uses originalId as the dedupe identity for legacy retry payloads', async () => {
    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    await expect(
      worker.processMessage('retry-msg-1', {
        ...baseEvent,
        originalId: 'legacy-original-1'
      } as ClickEventStream & { originalId: string })
    ).resolves.toBeUndefined();

    expect(state.committedRows).toEqual([
      { linkId: 'link-001', streamMessageId: 'legacy-original-1' }
    ]);
  });

  test('batch retries only when the transactional DB stage fails before commit', async () => {
    state.failLinkUpdate = true;

    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    const result = await worker.processMessages([
      { data: baseEvent, id: 'msg-batch-1' },
      {
        data: {
          ...baseEvent,
          shortCode: 'urlfy-2',
          timestamp: '2026-05-07T12:00:01.000Z'
        },
        id: 'msg-batch-2'
      }
    ]);

    expect(result.processedIds).toEqual([]);
    expect(result.failedMessages.map((message) => message.id)).toEqual([
      'msg-batch-1',
      'msg-batch-2'
    ]);
    expect(state.rollbackCount).toBe(1);
    expect(state.committedRows).toHaveLength(0);
    expect(state.committedUpdates).toHaveLength(0);
    expect(state.cacheCalls).toHaveLength(0);
    expect(state.drainCalls).toHaveLength(0);
  });

  test('batch keeps processed IDs when only post-commit reconciliation fails', async () => {
    state.failDrainPending = true;

    const workerModule = await loadWorkerModule();
    const worker = getWorkerAccess(workerModule);

    const result = await worker.processMessages([
      { data: baseEvent, id: 'msg-batch-3' },
      {
        data: {
          ...baseEvent,
          linkId: 'link-002',
          shortCode: 'urlfy-2',
          timestamp: '2026-05-07T12:00:02.000Z'
        },
        id: 'msg-batch-4'
      }
    ]);

    expect(result.failedMessages).toEqual([]);
    expect(result.processedIds).toEqual(['msg-batch-3', 'msg-batch-4']);
    expect(state.rollbackCount).toBe(0);
    expect(state.committedRows).toEqual([
      { linkId: 'link-001', streamMessageId: 'msg-batch-3' },
      { linkId: 'link-002', streamMessageId: 'msg-batch-4' }
    ]);
    expect(state.committedUpdates).toHaveLength(2);
    expect(state.cacheCalls).toEqual([
      { count: 1, shortCode: 'urlfy' },
      { count: 1, shortCode: 'urlfy-2' }
    ]);
    expect(state.drainCalls).toEqual([
      { count: 1, linkId: 'link-001' },
      { count: 1, linkId: 'link-002' }
    ]);
  });
});
