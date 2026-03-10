import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const redisStreamMock = {
  add: mock(async () => '1678900000000-0'),
  createGroup: mock(async () => {}),
  readGroup: mock(async () => []),
  ack: mock(
    async (_stream: string, _group: string, ids: string[]) => ids.length
  ),
  getLength: mock(async () => 10),
  info: mock(async () => ({ length: 10 })),
  groups: mock(async () => [{ name: 'test-group' }]),
  autoClaim: mock(async () => ({ messages: [], cursor: '0-0' })),
  getPendingCount: mock(async () => 0)
};

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

mock.module('@urlfy/cache', () => ({
  RedisStream: redisStreamMock,
  STREAM_NAMES: STREAM_NAMES_MOCK,
  CONSUMER_GROUPS: CONSUMER_GROUPS_MOCK
}));

const { CONSUMER_GROUPS, RedisStream, STREAM_NAMES } = await import(
  '@/server/lib/redis-stream'
);

describe('worker redis-stream shim', () => {
  beforeEach(() => {
    Object.values(redisStreamMock).forEach((method) => {
      method.mockClear();
    });
  });

  afterAll(() => {
    mock.restore();
  });

  it('re-exports the canonical stream names including dead-letter streams', () => {
    expect(STREAM_NAMES).toEqual(STREAM_NAMES_MOCK);
  });

  it('re-exports the canonical consumer groups', () => {
    expect(CONSUMER_GROUPS).toEqual(CONSUMER_GROUPS_MOCK);
  });

  it('forwards RedisStream.add calls through the shim', async () => {
    const messageId = await RedisStream.add('deletion', {
      requestId: 'req-123',
      userId: 'user-123'
    });

    expect(messageId).toBe('1678900000000-0');
    expect(redisStreamMock.add).toHaveBeenCalledWith('deletion', {
      requestId: 'req-123',
      userId: 'user-123'
    });
  });

  it('exposes the full RedisStream method surface used by workers', async () => {
    await RedisStream.createGroup('deletion', 'deletion-group');
    await RedisStream.readGroup('deletion-group', 'consumer-1', ['deletion']);
    await RedisStream.ack('deletion', 'deletion-group', ['1-0']);
    await RedisStream.getLength('deletion');
    await RedisStream.info('deletion');
    await RedisStream.groups('deletion');
    await RedisStream.autoClaim(
      'deletion',
      'deletion-group',
      'consumer-1',
      60000,
      '0-0',
      10
    );
    await RedisStream.getPendingCount('deletion', 'deletion-group');

    expect(redisStreamMock.createGroup).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.readGroup).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.ack).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.getLength).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.info).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.groups).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.autoClaim).toHaveBeenCalledTimes(1);
    expect(redisStreamMock.getPendingCount).toHaveBeenCalledTimes(1);
  });
});
