import { describe, expect, it, mock } from 'bun:test';

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {})
  }),
  circuitBreakerTrips: {
    add: mock(() => {})
  }
}));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CircuitBreaker', () => {
  it('opens after reaching failure threshold and rejects while open', async () => {
    const { CircuitBreaker } = await import('../circuit-breaker');

    const breaker = new CircuitBreaker({
      name: 'test-open',
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 50,
      resetTimeout: 1_000
    });

    const failing = async () => {
      throw new Error('boom');
    };

    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    expect(breaker.getStatus()).toBe('OPEN');

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow(
      "Circuit breaker 'test-open' is OPEN. Service unavailable."
    );
  });

  it('transitions OPEN -> HALF_OPEN -> CLOSED after recovery threshold', async () => {
    const { CircuitBreaker } = await import('../circuit-breaker');

    const breaker = new CircuitBreaker({
      name: 'test-recover',
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 20,
      resetTimeout: 1_000
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('fail-once');
      })
    ).rejects.toThrow('fail-once');
    expect(breaker.getStatus()).toBe('OPEN');

    await sleep(25);

    await expect(breaker.execute(async () => 's1')).resolves.toBe('s1');
    expect(breaker.getStatus()).toBe('HALF_OPEN');

    await expect(breaker.execute(async () => 's2')).resolves.toBe('s2');
    expect(breaker.getStatus()).toBe('CLOSED');
  });

  it('reopens when a HALF_OPEN probe fails', async () => {
    const { CircuitBreaker } = await import('../circuit-breaker');

    const breaker = new CircuitBreaker({
      name: 'test-half-open-fail',
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 20,
      resetTimeout: 1_000
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('first-failure');
      })
    ).rejects.toThrow('first-failure');
    expect(breaker.getStatus()).toBe('OPEN');

    await sleep(25);

    await expect(
      breaker.execute(async () => {
        throw new Error('probe-failure');
      })
    ).rejects.toThrow('probe-failure');
    expect(breaker.getStatus()).toBe('OPEN');
  });

  it('executeWithFallback uses fallback when breaker path fails', async () => {
    const { CircuitBreaker, executeWithFallback } = await import(
      '../circuit-breaker'
    );

    const breaker = new CircuitBreaker({
      name: 'test-fallback',
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 20,
      resetTimeout: 1_000
    });

    const result = await executeWithFallback(
      async () => {
        throw new Error('primary-failed');
      },
      async () => 'fallback-ok',
      breaker
    );

    expect(result).toBe('fallback-ok');
  });
});
