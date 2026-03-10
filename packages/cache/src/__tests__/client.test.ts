import { beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {})
  })
}));

import {
  canAttemptRedisCommand,
  checkRedisHealth,
  getRedisClient,
  getRedisHealthSnapshot,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redisHealth,
  shouldLogRedisFailure
} from '../client';

function resetRedisHealthState() {
  redisHealth.isHealthy = false;
  redisHealth.isConnected = false;
  redisHealth.isDegraded = false;
  redisHealth.consecutiveFailures = 0;
  redisHealth.lastError = null;
  redisHealth.lastConnectedAt = null;
  redisHealth.lastFailureAt = null;
  redisHealth.lastSuccessfulCommandAt = null;
  redisHealth.degradedUntil = null;
  markRedisCommandSuccess();
  redisHealth.isHealthy = false;
  redisHealth.isConnected = false;
  redisHealth.lastSuccessfulCommandAt = null;
}

describe('redis client health state', () => {
  beforeEach(() => {
    resetRedisHealthState();
  });

  it('enters a degraded window after command failure and recovers after the window expires', () => {
    markRedisCommandFailure(new Error('redis unavailable'));

    const degraded = getRedisHealthSnapshot();

    expect(degraded.isHealthy).toBe(false);
    expect(degraded.isConnected).toBe(false);
    expect(degraded.isDegraded).toBe(true);
    expect(degraded.consecutiveFailures).toBe(1);
    expect(degraded.lastError).toBe('redis unavailable');
    expect(degraded.lastFailureAt).not.toBeNull();
    expect(degraded.degradedUntil).not.toBeNull();
    expect(canAttemptRedisCommand((degraded.degradedUntil ?? 0) - 1)).toBe(
      false
    );
    expect(canAttemptRedisCommand((degraded.degradedUntil ?? 0) + 1)).toBe(
      true
    );
    expect(getRedisHealthSnapshot().isDegraded).toBe(false);
  });

  it('caps degraded backoff growth at thirty seconds', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      markRedisCommandFailure(new Error(`failure-${attempt}`));
    }

    const snapshot = getRedisHealthSnapshot();

    expect(snapshot.consecutiveFailures).toBe(10);
    expect(snapshot.lastFailureAt).not.toBeNull();
    expect(snapshot.degradedUntil).not.toBeNull();
    expect((snapshot.degradedUntil ?? 0) - (snapshot.lastFailureAt ?? 0)).toBe(
      30_000
    );
  });

  it('resets degraded state and log throttling after a successful command', () => {
    markRedisCommandFailure(new Error('first failure'));

    expect(shouldLogRedisFailure(100)).toBe(true);
    expect(shouldLogRedisFailure(101)).toBe(false);

    markRedisCommandSuccess();

    const snapshot = getRedisHealthSnapshot();

    expect(snapshot.isHealthy).toBe(true);
    expect(snapshot.isConnected).toBe(true);
    expect(snapshot.isDegraded).toBe(false);
    expect(snapshot.consecutiveFailures).toBe(0);
    expect(snapshot.lastError).toBeNull();
    expect(snapshot.degradedUntil).toBeNull();
    expect(snapshot.lastSuccessfulCommandAt).not.toBeNull();
    expect(shouldLogRedisFailure(200)).toBe(true);
  });

  it('retries transient ping failures before reporting redis unhealthy', async () => {
    const globalScope = globalThis as {
      __REDIS_CLIENT__?: {
        send: (command: string, args: string[]) => Promise<string>;
      };
    };
    const previousOverride = globalScope.__REDIS_CLIENT__;
    let attempts = 0;

    globalScope.__REDIS_CLIENT__ = {
      send: async (command: string, args: string[]) => {
        attempts++;

        expect(command).toBe('PING');
        expect(args).toEqual([]);

        if (attempts === 1) {
          throw new Error('Connection not ready');
        }

        return 'PONG';
      }
    };

    try {
      const health = await checkRedisHealth();

      expect(health.status).toBe('ok');
      expect(attempts).toBe(2);
      expect(redisHealth.isHealthy).toBe(true);
      expect(redisHealth.isConnected).toBe(true);
      expect(redisHealth.consecutiveFailures).toBe(0);
      expect(redisHealth.lastError).toBeNull();
    } finally {
      globalScope.__REDIS_CLIENT__ = previousOverride;
    }
  });
});

describe('getRedisClient singleton', () => {
  it('returns the same instance on every call (no duplicate construction)', () => {
    // In NODE_ENV=test all calls return the in-memory mock singleton.
    // This verifies that parallel callers cannot race into constructing two
    // separate client objects — the null-check + synchronous constructor
    // assignment is always atomic within JavaScript's single-threaded model.
    const first = getRedisClient();
    const second = getRedisClient();
    const third = getRedisClient();

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('returns the test override when __REDIS_CLIENT__ is set', () => {
    const globalScope = globalThis as { __REDIS_CLIENT__?: unknown };
    const fakeSentinel = { _isFakeSentinel: true } as unknown as ReturnType<
      typeof getRedisClient
    >;
    const previous = globalScope.__REDIS_CLIENT__;
    globalScope.__REDIS_CLIENT__ = fakeSentinel;

    try {
      const result = getRedisClient();
      expect(result).toBe(fakeSentinel);
    } finally {
      globalScope.__REDIS_CLIENT__ = previous;
    }
  });
});
