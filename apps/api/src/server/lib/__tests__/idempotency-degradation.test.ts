import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

const failures = {
  canAttempt: true,
  checkRead: false,
  lockSet: false,
  setResult: false,
  releaseDel: false
};

const runtimeState = {
  consecutiveFailures: 0,
  shouldLogFailure: true
};

const redisMock = {
  get: mock(async () => {
    if (failures.checkRead) {
      throw new Error('redis read failure');
    }
    return null;
  }),
  send: mock(async (command: string) => {
    if (command === 'SET' && failures.lockSet) {
      throw new Error('redis lock failure');
    }
    return 'OK';
  }),
  set: mock(async () => {
    if (failures.setResult) {
      throw new Error('redis set failure');
    }
    return 'OK';
  }),
  del: mock(async () => {
    if (failures.releaseDel) {
      throw new Error('redis del failure');
    }
    return 1;
  })
};

mock.module('@/server/lib/telemetry', () => ({
  createLogger: () => ({
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {})
  }),
  configureLogging: async () => {}
}));

describe('Idempotency degradation handling', () => {
  beforeEach(async () => {
    failures.canAttempt = true;
    failures.checkRead = false;
    failures.lockSet = false;
    failures.setResult = false;
    failures.releaseDel = false;
    runtimeState.consecutiveFailures = 0;
    runtimeState.shouldLogFailure = true;

    redisMock.get.mockClear();
    redisMock.send.mockClear();
    redisMock.set.mockClear();
    redisMock.del.mockClear();

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
      canAttemptRedisCommand: () => failures.canAttempt,
      getRedisClient: () => redisMock,
      markRedisCommandFailure: () => {
        runtimeState.consecutiveFailures += 1;
        failures.canAttempt = false;
      },
      markRedisCommandSuccess: () => {
        runtimeState.consecutiveFailures = 0;
        failures.canAttempt = true;
      },
      shouldLogRedisFailure: () => runtimeState.shouldLogFailure
    };
  });

  afterAll(() => {
    delete (globalThis as { __IDEMPOTENCY_RUNTIME__?: unknown })
      .__IDEMPOTENCY_RUNTIME__;
    mock.restore();
  });

  it('returns miss when Redis read fails in checkIdempotency', async () => {
    failures.checkRead = true;

    const { checkIdempotency } = await import('../idempotency');
    const result = await checkIdempotency('k1', 'user-1', 'POST /links');

    expect(result).toEqual({ status: 'miss' });

    expect(runtimeState.consecutiveFailures).toBeGreaterThan(0);
  });

  it('degrades open when Redis lock acquisition fails', async () => {
    failures.lockSet = true;

    const { acquireIdempotencyLock } = await import('../idempotency');
    const acquired = await acquireIdempotencyLock(
      'k2',
      'user-1',
      'POST /links',
      'payload-hash'
    );

    expect(acquired).toBe(true);

    expect(runtimeState.consecutiveFailures).toBeGreaterThan(0);
  });

  it('does not throw when Redis write-back fails in setIdempotency', async () => {
    failures.setResult = true;

    const { setIdempotency } = await import('../idempotency');

    await expect(
      setIdempotency('k3', 'resource-1', 'user-1', 'POST /links', 'payload')
    ).resolves.toBeUndefined();

    expect(runtimeState.consecutiveFailures).toBeGreaterThan(0);
  });

  it('short-circuits Redis operations when command attempts are disabled', async () => {
    failures.canAttempt = false;
    runtimeState.consecutiveFailures += 1;

    const {
      acquireIdempotencyLock,
      checkIdempotency,
      releaseIdempotencyLock,
      setIdempotency
    } = await import('../idempotency');

    await expect(
      checkIdempotency('k4', 'user-1', 'POST /links')
    ).resolves.toEqual({ status: 'miss' });
    await expect(
      acquireIdempotencyLock('k4', 'user-1', 'POST /links', 'hash')
    ).resolves.toBe(true);
    await expect(
      setIdempotency('k4', 'resource-4', 'user-1', 'POST /links', 'hash')
    ).resolves.toBeUndefined();
    await expect(
      releaseIdempotencyLock('k4', 'user-1', 'POST /links')
    ).resolves.toBeUndefined();

    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.send).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
