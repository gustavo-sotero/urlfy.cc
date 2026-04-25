import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createInMemoryRedisClient,
  drainPendingClicks,
  getPendingClicks,
  getPendingClicksMap,
  getPendingClicksTotal,
  incrementPendingClicks
} from '..';

describe('realtime-clicks', () => {
  beforeEach(async () => {
    const redis = createInMemoryRedisClient();
    (
      globalThis as {
        __REDIS_CLIENT__?: ReturnType<typeof createInMemoryRedisClient>;
      }
    ).__REDIS_CLIENT__ = redis;
    await redis.send('FLUSHALL', []);
  });

  it('tracks pending clicks per link and drains them back to zero', async () => {
    expect(await getPendingClicks('link-1')).toBe(0);

    await incrementPendingClicks('link-1');
    await incrementPendingClicks('link-1', 2);

    expect(await getPendingClicks('link-1')).toBe(3);

    await drainPendingClicks('link-1', 2);
    expect(await getPendingClicks('link-1')).toBe(1);

    await drainPendingClicks('link-1', 5);
    expect(await getPendingClicks('link-1')).toBe(0);
  });

  it('returns per-link and total counts in batch reads', async () => {
    await incrementPendingClicks('link-a', 2);
    await incrementPendingClicks('link-b', 3);

    const counts = await getPendingClicksMap(['link-a', 'link-b', 'link-c']);

    expect(counts.get('link-a')).toBe(2);
    expect(counts.get('link-b')).toBe(3);
    expect(counts.has('link-c')).toBe(false);
    expect(await getPendingClicksTotal(['link-a', 'link-b', 'link-c'])).toBe(5);
  });
});
