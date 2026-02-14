import { beforeEach, describe, expect, it, mock } from 'bun:test';

const redisMock = {
  send: mock(() => Promise.resolve(1)),
  pexpire: mock(() => Promise.resolve(1)),
  pttl: mock(() => Promise.resolve(1000))
};

mock.module('@/server/lib/redis', () => ({
  redis: redisMock
}));

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  })
}));

describe('enforceApiKeyRateLimit', () => {
  beforeEach(() => {
    redisMock.send.mockReset();
    redisMock.pexpire.mockReset();
    redisMock.pttl.mockReset();
  });

  it('allows request when Redis counter is below limit', async () => {
    redisMock.send.mockResolvedValueOnce(1);
    redisMock.pexpire.mockResolvedValueOnce(1);

    const { enforceApiKeyRateLimit } = await import('../helpers');
    const result = await enforceApiKeyRateLimit('key-1', 100, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('denies request fail-closed when Redis is unavailable', async () => {
    redisMock.send.mockRejectedValueOnce(new Error('Redis unavailable'));

    const { enforceApiKeyRateLimit } = await import('../helpers');
    const result = await enforceApiKeyRateLimit('key-1', 100, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(30);
  });
});
