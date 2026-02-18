import { beforeEach, describe, expect, it, mock } from 'bun:test';

const store = new Map<string, string>();

const redisMock = {
  get: mock((key: string) => Promise.resolve(store.get(key) ?? null)),
  set: mock((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve('OK');
  })
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
  }),
  configureLogging: async () => {}
}));

describe('Idempotency key scoping', () => {
  beforeEach(() => {
    store.clear();
    redisMock.get.mockClear();
    redisMock.set.mockClear();
  });

  it('isolates keys by principal', async () => {
    const { setIdempotency, checkIdempotency } = await import('../idempotency');

    await setIdempotency(
      'same-key',
      'resource-user-a',
      'user-a',
      'POST /links'
    );
    await setIdempotency(
      'same-key',
      'resource-user-b',
      'user-b',
      'POST /links'
    );

    const userA = await checkIdempotency('same-key', 'user-a', 'POST /links');
    const userB = await checkIdempotency('same-key', 'user-b', 'POST /links');

    expect(userA).toBe('resource-user-a');
    expect(userB).toBe('resource-user-b');
  });

  it('isolates keys by route', async () => {
    const { setIdempotency, checkIdempotency } = await import('../idempotency');

    await setIdempotency(
      'same-key',
      'resource-create',
      'user-a',
      'POST /links'
    );
    await setIdempotency(
      'same-key',
      'resource-bulk',
      'user-a',
      'POST /links/bulk'
    );

    const createResult = await checkIdempotency(
      'same-key',
      'user-a',
      'POST /links'
    );
    const bulkResult = await checkIdempotency(
      'same-key',
      'user-a',
      'POST /links/bulk'
    );

    expect(createResult).toBe('resource-create');
    expect(bulkResult).toBe('resource-bulk');
  });
});
