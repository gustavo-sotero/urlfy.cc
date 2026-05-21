import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';

const loggerInstance = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {})
};

const redisClient = {
  get: mock(async () => null as string | null),
  set: mock(async () => 'OK'),
  send: mock(async () => 1),
  expire: mock(async () => 1)
};

mock.module('@/server/lib/telemetry', () =>
  createTelemetryModuleMock({
    createLogger: () => loggerInstance
  })
);

// Spread real module so the full export surface is preserved when Bun does not
// reset mock.module state between test files (Windows / shared-worker mode).
const realRedisModule = await import('@/server/lib/redis');
mock.module('@/server/lib/redis', () => ({
  ...realRedisModule,
  getRedisClient: () => redisClient
}));

const { withCache } = await import(
  '../../src/server/modules/analytics/analytics.helpers.ts?analytics-cache-test'
);

beforeEach(() => {
  redisClient.get.mockReset();
  redisClient.set.mockReset();
  redisClient.send.mockReset();
  redisClient.expire.mockReset();
  loggerInstance.warn.mockReset();

  redisClient.get.mockResolvedValue(null);
  redisClient.set.mockResolvedValue('OK');
  redisClient.send.mockResolvedValue(1);
  redisClient.expire.mockResolvedValue(1);
});

describe('analytics cache helper', () => {
  it('does not cache fallback-shaped data when the fetcher fails', async () => {
    const fetchError = new Error('database unavailable');

    await expect(
      withCache('analytics:test:failure', 60, async () => {
        throw fetchError;
      })
    ).rejects.toThrow('database unavailable');

    expect(redisClient.set).not.toHaveBeenCalled();
    expect(redisClient.send).not.toHaveBeenCalled();
    expect(redisClient.expire).not.toHaveBeenCalled();
  });

  it('still caches authoritative empty results returned by a successful fetcher', async () => {
    const data = await withCache('analytics:test:empty', 60, async () => []);

    expect(data).toEqual([]);
    expect(redisClient.set).toHaveBeenCalledWith(
      'analytics:test:empty',
      '[]',
      'EX',
      60
    );
  });
});
