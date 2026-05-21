import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createTelemetryModuleMock } from '@/test-utils/real-telemetry';

const store = new Map<string, string>();

const redisMock = {
  get: mock((key: string) => Promise.resolve(store.get(key) ?? null)),
  set: mock((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve('OK');
  }),
  del: mock((key: string) => {
    store.delete(key);
    return Promise.resolve(1);
  }),
  send: mock((command: string, args: string[]) => {
    if (command === 'SET') {
      const [key, value, nx, ex, _ttl] = args;
      if (nx === 'NX' && ex === 'EX') {
        if (store.has(key)) return Promise.resolve(null);
        store.set(key, value ?? 'pending');
        return Promise.resolve('OK');
      }
    }
    return Promise.resolve(null);
  })
};

mock.module('@/server/lib/telemetry', () =>
  createTelemetryModuleMock({
    createLogger: () => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    })
  })
);

describe('Idempotency key scoping', () => {
  beforeEach(async () => {
    store.clear();
    redisMock.get.mockClear();
    redisMock.set.mockClear();
    redisMock.del.mockClear();
    redisMock.send.mockClear();

    (
      globalThis as {
        __IDEMPOTENCY_RUNTIME__?: {
          canAttemptRedisCommand: () => boolean;
          getRedisClient: () => typeof redisMock;
          markRedisCommandFailure: (_error: unknown) => void;
          markRedisCommandSuccess: () => void;
          shouldLogRedisFailure: () => boolean;
        };
      }
    ).__IDEMPOTENCY_RUNTIME__ = {
      canAttemptRedisCommand: () => true,
      getRedisClient: () => redisMock,
      markRedisCommandFailure: () => {},
      markRedisCommandSuccess: () => {},
      shouldLogRedisFailure: () => false
    };
  });

  afterAll(() => {
    delete (globalThis as { __IDEMPOTENCY_RUNTIME__?: unknown })
      .__IDEMPOTENCY_RUNTIME__;
    mock.restore();
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

    expect(userA).toEqual({ status: 'hit', resourceId: 'resource-user-a' });
    expect(userB).toEqual({ status: 'hit', resourceId: 'resource-user-b' });
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

    expect(createResult).toEqual({
      status: 'hit',
      resourceId: 'resource-create'
    });
    expect(bulkResult).toEqual({ status: 'hit', resourceId: 'resource-bulk' });
  });

  it('returns miss for unknown key', async () => {
    const { checkIdempotency } = await import('../idempotency');
    const result = await checkIdempotency(
      'unknown-key',
      'user-a',
      'POST /links'
    );
    expect(result).toEqual({ status: 'miss' });
  });

  it('detects payload conflict when hash differs', async () => {
    const { setIdempotency, checkIdempotency } = await import('../idempotency');

    await setIdempotency(
      'conflict-key',
      'resource-original',
      'user-a',
      'POST /links',
      'hash-original'
    );

    const conflict = await checkIdempotency(
      'conflict-key',
      'user-a',
      'POST /links',
      'hash-different'
    );

    expect(conflict).toEqual({ status: 'conflict' });
  });

  it('returns hit when payload hash matches', async () => {
    const { setIdempotency, checkIdempotency } = await import('../idempotency');

    await setIdempotency(
      'match-key',
      'resource-replay',
      'user-a',
      'POST /links',
      'hash-abc'
    );

    const hit = await checkIdempotency(
      'match-key',
      'user-a',
      'POST /links',
      'hash-abc'
    );

    expect(hit).toEqual({ status: 'hit', resourceId: 'resource-replay' });
  });

  it('handles legacy plain-string entries without conflict', async () => {
    // Simulate a key stored before the fingerprint feature was introduced
    const { checkIdempotency } = await import('../idempotency');
    const legacyKey = 'idempotency:user-a:POST /links:legacy-key';
    store.set(legacyKey, 'legacy-resource-id'); // plain string, not JSON

    const result = await checkIdempotency(
      'legacy-key',
      'user-a',
      'POST /links',
      'any-hash'
    );

    // Should be a hit (no conflict) because stored entry has no hash to compare against
    expect(result).toEqual({ status: 'hit', resourceId: 'legacy-resource-id' });
  });

  it('returns in_progress when lock exists and result is not persisted yet', async () => {
    const { acquireIdempotencyLock, checkIdempotency } = await import(
      '../idempotency'
    );

    const acquired = await acquireIdempotencyLock(
      'pending-key',
      'user-a',
      'POST /links',
      'hash-123'
    );
    expect(acquired).toBe(true);

    const result = await checkIdempotency(
      'pending-key',
      'user-a',
      'POST /links',
      'hash-123'
    );

    expect(result).toEqual({ status: 'in_progress' });
  });
});
