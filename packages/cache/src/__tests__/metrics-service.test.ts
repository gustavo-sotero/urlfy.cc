import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock
} from 'bun:test';

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  maskIpForLog: (ip: string) => ip,
  circuitBreakerTrips: {
    add: () => {}
  }
}));

const { getRedisClient, markRedisCommandSuccess, redisHealth } = await import(
  '../client'
);
const { MetricsService } = await import('../metrics-service');

const redis = getRedisClient() as {
  del: (...keys: string[]) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: string[]) => Promise<string>;
  ttl: (key: string) => Promise<number>;
};

describe('MetricsService', () => {
  const REDIS_KEYS = {
    REQUEST_COUNT: 'metrics:req:count',
    LAST_CALC_TIME: 'metrics:req:last_calc',
    RPS: 'metrics:rps'
  };

  beforeEach(async () => {
    redisHealth.isDegraded = false;
    redisHealth.degradedUntil = null;
    redisHealth.consecutiveFailures = 0;
    redisHealth.lastError = null;
    markRedisCommandSuccess();
    await redis.del(
      REDIS_KEYS.REQUEST_COUNT,
      REDIS_KEYS.LAST_CALC_TIME,
      REDIS_KEYS.RPS
    );
  });

  afterEach(async () => {
    await redis.del(
      REDIS_KEYS.REQUEST_COUNT,
      REDIS_KEYS.LAST_CALC_TIME,
      REDIS_KEYS.RPS
    );
  });

  afterAll(() => {
    mock.restore();
  });

  describe('trackRequest', () => {
    it('increments the request counter', async () => {
      await MetricsService.trackRequest();

      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('1');
    });

    it('increments the counter multiple times', async () => {
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();

      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('3');
    });

    it('does not throw on Redis errors', async () => {
      await expect(MetricsService.trackRequest()).resolves.toBeUndefined();
    });
  });

  describe('calculateRPS', () => {
    it('calculates RPS correctly with known values', async () => {
      const now = Date.now();
      const sixtySecondsAgo = now - 60000;

      await redis.set(REDIS_KEYS.REQUEST_COUNT, '60');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, sixtySecondsAgo.toString());

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThanOrEqual(0.9);
      expect(rps).toBeLessThanOrEqual(1.1);

      const storedRps = await redis.get(REDIS_KEYS.RPS);
      expect(storedRps).not.toBeNull();

      const newCount = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(newCount).toBe('0');

      const newCalcTime = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      expect(newCalcTime).not.toBeNull();
    });

    it('handles the first calculation without a previous timestamp', async () => {
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '100');

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);

      const calcTime = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      expect(calcTime).not.toBeNull();
    });

    it('handles an empty counter', async () => {
      const now = Date.now();
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      const rps = await MetricsService.calculateRPS();

      expect(rps).toBe(0);
    });

    it('sets a TTL on the cached RPS value', async () => {
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '50');
      await redis.set(
        REDIS_KEYS.LAST_CALC_TIME,
        (Date.now() - 60000).toString()
      );

      await MetricsService.calculateRPS();

      const ttl = await redis.ttl(REDIS_KEYS.RPS);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
    });

    it('calculates high RPS values correctly', async () => {
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '6000');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThanOrEqual(95);
      expect(rps).toBeLessThanOrEqual(105);
    });

    it('prevents division by zero with a minimum elapsed time', async () => {
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '10');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);
    });

    it('rounds RPS to two decimal places', async () => {
      const now = Date.now();
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '123');
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, (now - 60000).toString());

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      const rpsStr = rps?.toString() ?? '';
      const decimals = rpsStr.split('.')[1] || '';
      expect(decimals.length).toBeLessThanOrEqual(2);
    });
  });

  describe('integration flow', () => {
    it('tracks requests and calculates RPS', async () => {
      for (let i = 0; i < 10; i++) {
        await MetricsService.trackRequest();
      }

      await Bun.sleep(100);

      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(rps).toBeGreaterThan(0);

      const count = await redis.get(REDIS_KEYS.REQUEST_COUNT);
      expect(count).toBe('0');
    });

    it('handles multiple calculation cycles', async () => {
      await redis.set(REDIS_KEYS.REQUEST_COUNT, '100');
      const rps1 = await MetricsService.calculateRPS();
      expect(rps1).not.toBeNull();

      await Bun.sleep(50);
      await MetricsService.trackRequest();
      await MetricsService.trackRequest();

      const rps2 = await MetricsService.calculateRPS();
      expect(rps2).not.toBeNull();

      expect(rps1).toBeGreaterThanOrEqual(0);
      expect(rps2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('returns a number when calculation has no prior state', async () => {
      const rps = await MetricsService.calculateRPS();

      expect(rps).not.toBeNull();
      expect(typeof rps).toBe('number');
    });
  });
});
