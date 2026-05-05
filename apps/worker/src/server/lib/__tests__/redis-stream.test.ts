import { describe, expect, it } from 'bun:test';

async function importFreshModule<T>(path: string): Promise<T> {
  return (await import(`${path}?worker-redis-stream-shim-test-module`)) as T;
}

const { CONSUMER_GROUPS, RedisStream, STREAM_NAMES } =
  await importFreshModule<typeof import('@/server/lib/redis-stream')>(
    '../redis-stream.ts'
  );

describe('worker redis-stream shim', () => {
  it('exposes the canonical worker stream names including dead-letter streams', () => {
    expect(STREAM_NAMES).toEqual({
      analyticsClicks: 'analytics:clicks',
      analyticsDead: 'analytics:dead',
      aggregation: 'aggregation',
      aggregationDead: 'aggregation:dead',
      cleanup: 'cleanup',
      cleanupDead: 'cleanup:dead',
      deletion: 'deletion',
      deletionDead: 'deletion:dead',
      notifications: 'notifications'
    });
  });

  it('exposes the canonical worker consumer groups', () => {
    expect(CONSUMER_GROUPS).toEqual({
      analytics: 'analytics-group',
      analyticsDead: 'analytics-dead-group',
      aggregation: 'aggregation-group',
      cleanup: 'cleanup-group',
      deletion: 'deletion-group',
      notifications: 'notifications-group'
    });
  });

  it('exposes the expected RedisStream namespace shape for worker consumers', () => {
    expect(Object.keys(RedisStream).sort()).toEqual([
      'ack',
      'add',
      'autoClaim',
      'createGroup',
      'getLength',
      'getPendingCount',
      'groups',
      'info',
      'readGroup'
    ]);
  });

  it('exposes the full RedisStream method surface used by workers', async () => {
    expect(typeof RedisStream.add).toBe('function');
    expect(typeof RedisStream.createGroup).toBe('function');
    expect(typeof RedisStream.readGroup).toBe('function');
    expect(typeof RedisStream.ack).toBe('function');
    expect(typeof RedisStream.getLength).toBe('function');
    expect(typeof RedisStream.info).toBe('function');
    expect(typeof RedisStream.groups).toBe('function');
    expect(typeof RedisStream.autoClaim).toBe('function');
    expect(typeof RedisStream.getPendingCount).toBe('function');
  });
});
