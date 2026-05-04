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
  let redis: ReturnType<typeof createInMemoryRedisClient>;

  beforeEach(async () => {
    redis = createInMemoryRedisClient();
    await redis.send('FLUSHALL', []);
  });

  it('tracks pending clicks per link and drains them back to zero', async () => {
    expect(await getPendingClicks('link-1', redis)).toBe(0);

    await incrementPendingClicks('link-1', 1, redis);
    await incrementPendingClicks('link-1', 2, redis);

    expect(await getPendingClicks('link-1', redis)).toBe(3);

    await drainPendingClicks('link-1', 2, redis);
    expect(await getPendingClicks('link-1', redis)).toBe(1);

    await drainPendingClicks('link-1', 5, redis);
    expect(await getPendingClicks('link-1', redis)).toBe(0);
  });

  it('returns per-link and total counts in batch reads', async () => {
    await incrementPendingClicks('link-a', 2, redis);
    await incrementPendingClicks('link-b', 3, redis);

    const counts = await getPendingClicksMap(
      ['link-a', 'link-b', 'link-c'],
      redis
    );

    expect(counts.get('link-a')).toBe(2);
    expect(counts.get('link-b')).toBe(3);
    expect(counts.has('link-c')).toBe(false);
    expect(
      await getPendingClicksTotal(['link-a', 'link-b', 'link-c'], redis)
    ).toBe(5);
  });
});
