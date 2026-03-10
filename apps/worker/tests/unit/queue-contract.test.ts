import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const addMock = mock(async () => 'stream-id-1');

mock.module('@urlfy/cache', () => ({
  RedisStream: {
    add: addMock
  },
  STREAM_NAMES: {
    analyticsClicks: 'analytics:clicks',
    analyticsDead: 'analytics:dead',
    aggregation: 'aggregation',
    aggregationDead: 'aggregation:dead',
    cleanup: 'cleanup',
    cleanupDead: 'cleanup:dead',
    deletion: 'deletion',
    deletionDead: 'deletion:dead',
    notifications: 'notifications'
  },
  CONSUMER_GROUPS: {
    analytics: 'analytics-group',
    analyticsDead: 'analytics-dead-group',
    aggregation: 'aggregation-group',
    cleanup: 'cleanup-group',
    deletion: 'deletion-group',
    notifications: 'notifications-group'
  }
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
