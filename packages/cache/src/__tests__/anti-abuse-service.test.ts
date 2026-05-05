import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

async function importFreshModule<T>(path: string): Promise<T> {
  return (await import(`${path}?cache-anti-abuse-test-module`)) as T;
}

const realTelemetryModule = await importFreshModule<
  typeof import('../../../telemetry/src/index.ts')
>('../../../telemetry/src/index.ts');

type TestRedisClient = Pick<
  typeof import('../client').redis,
  'del' | 'expire' | 'get' | 'incr' | 'send' | 'set' | 'setex'
>;

const expiryStore = new Map<string, number>();
const valueStore = new Map<string, string>();

const mockRedis = {
  incr: mock(async (key: string): Promise<number> => {
    const current = Number.parseInt(valueStore.get(key) || '0', 10);
    const next = current + 1;
    valueStore.set(key, String(next));
    return next;
  }),
  expire: mock(async (key: string, ttl: number): Promise<number> => {
    expiryStore.set(key, ttl);
    return 1;
  }),
  get: mock(async (key: string): Promise<string | null> => {
    return valueStore.get(key) || null;
  }),
  setex: mock(
    async (key: string, ttl: number, value: string): Promise<'OK'> => {
      valueStore.set(key, value);
      expiryStore.set(key, ttl);
      return 'OK';
    }
  ),
  set: mock(async (key: string, value: string): Promise<'OK'> => {
    valueStore.set(key, value);
    return 'OK';
  }),
  del: mock(async (key: string): Promise<number> => {
    const existed = valueStore.delete(key);
    expiryStore.delete(key);
    return existed ? 1 : 0;
  }),
  send: mock(async (command: string, args: string[]): Promise<number> => {
    if (command.toUpperCase() === 'EXISTS') {
      return valueStore.has(args[0] || '') ? 1 : 0;
    }

    throw new Error(`Unsupported command: ${command}`);
  })
} satisfies TestRedisClient;

const warnLog = mock(() => {});
const errorLog = mock(() => {});
const infoLog = mock(() => {});

mock.module('@urlfy/telemetry', () => ({
  ...realTelemetryModule,
  createLogger: () => ({
    debug: () => {},
    info: infoLog,
    warn: warnLog,
    error: errorLog
  }),
  circuitBreakerTrips: {
    add: () => {}
  },
  maskIpForLog: (ip: string) => `ip:${ip}`
}));

const { markRedisCommandSuccess, redisHealth } = await import('../client');
const { AntiAbuseService } = await importFreshModule<
  typeof import('../anti-abuse-service')
>('../anti-abuse-service');

describe('AntiAbuseService', () => {
  let service: InstanceType<typeof AntiAbuseService>;

  beforeEach(() => {
    redisHealth.isDegraded = false;
    redisHealth.degradedUntil = null;
    redisHealth.consecutiveFailures = 0;
    redisHealth.lastError = null;
    markRedisCommandSuccess();
    valueStore.clear();
    expiryStore.clear();
    mockRedis.incr.mockClear();
    mockRedis.expire.mockClear();
    mockRedis.get.mockClear();
    mockRedis.setex.mockClear();
    mockRedis.set.mockClear();
    mockRedis.del.mockClear();
    mockRedis.send.mockClear();
    warnLog.mockClear();
    errorLog.mockClear();
    infoLog.mockClear();
    service = new AntiAbuseService(mockRedis);
  });

  afterAll(() => {
    mock.restore();
  });

  it('records abuse events with the expected TTL window', async () => {
    await service.recordEvent('LOGIN_FAILURES', '203.0.113.10');

    expect(valueStore.get('abuse:LOGIN_FAILURES:203.0.113.10')).toBe('1');
    expect(expiryStore.get('abuse:LOGIN_FAILURES:203.0.113.10')).toBe(300);
  });

  it('detects anomalous counters at or above the threshold', async () => {
    valueStore.set('abuse:SIGNUP_ATTEMPTS:203.0.113.10', '10');

    const anomalous = await service.isAnomalous(
      'SIGNUP_ATTEMPTS',
      '203.0.113.10'
    );

    expect(anomalous).toBe(true);
  });

  it('fails open when Redis command attempts are disabled', async () => {
    redisHealth.isDegraded = true;
    redisHealth.degradedUntil = Date.now() + 60_000;

    expect(await service.isAnomalous('LOGIN_FAILURES', '203.0.113.10')).toBe(
      false
    );
    expect(await service.isIPBlocked('203.0.113.10')).toBe(false);
    expect(await service.getEventCount('LOGIN_FAILURES', '203.0.113.10')).toBe(
      0
    );
  });

  it('blocks and unblocks an IP using the canonical blocked key', async () => {
    await service.blockIP('203.0.113.10', 'too many failures', 900);

    expect(await service.isIPBlocked('203.0.113.10')).toBe(true);
    expect(valueStore.has('blocked:ip:203.0.113.10')).toBe(true);

    await service.unblockIP('203.0.113.10');

    expect(await service.isIPBlocked('203.0.113.10')).toBe(false);
  });

  it('records login failures and blocks when the threshold is crossed', async () => {
    valueStore.set('abuse:LOGIN_FAILURES:203.0.113.10', '49');

    const blocked = await service.recordLoginFailure('203.0.113.10');

    expect(blocked).toBe(true);
    expect(await service.isIPBlocked('203.0.113.10')).toBe(true);
  });
});
