import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const realCacheModule = await import(
  '../../../../packages/cache/src/index.ts?worker-queue-contract-real-cache'
);

const addMock = mock(async () => 'stream-id-1');

mock.module('@urlfy/cache', () => ({
  ...realCacheModule,
  RedisStream: {
    ...realCacheModule.RedisStream,
    add: addMock
  },
  STREAM_NAMES: { ...realCacheModule.STREAM_NAMES },
  CONSUMER_GROUPS: { ...realCacheModule.CONSUMER_GROUPS }
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {})
  }),
  configureLogging: async () => {}
}));

describe('queue/stream contract', () => {
  beforeEach(() => {
    addMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test('scheduleAggregation publishes canonical payload', async () => {
    const { scheduleAggregation, STREAM_NAMES } = await import(
      '../../src/server/lib/queue'
    );

    const id = await scheduleAggregation('2026-03-09');

    expect(id).toBe('stream-id-1');
    expect(addMock).toHaveBeenCalledWith(STREAM_NAMES.aggregation, {
      date: '2026-03-09'
    });
  });

  test('scheduleCleanup publishes canonical payload', async () => {
    const { scheduleCleanup, STREAM_NAMES } = await import(
      '../../src/server/lib/queue'
    );

    const id = await scheduleCleanup('full');

    expect(id).toBe('stream-id-1');
    expect(addMock).toHaveBeenCalledWith(STREAM_NAMES.cleanup, {
      type: 'full'
    });
  });

  test('scheduleDeletion publishes canonical payload shape consumed by worker', async () => {
    const { scheduleDeletion, STREAM_NAMES } = await import(
      '../../src/server/lib/queue'
    );

    const id = await scheduleDeletion('req-123', 'user-123');

    expect(id).toBe('stream-id-1');
    expect(addMock).toHaveBeenCalledWith(STREAM_NAMES.deletion, {
      requestId: 'req-123',
      userId: 'user-123'
    });
  });
});
