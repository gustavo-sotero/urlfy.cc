/**
 * Unit tests for Redis Streams Wrapper
 */

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Mock telemetry
const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
  warn: mock(() => {})
};

const noOpCounter = { add: mock(() => {}) };
mock.module('@urlfy/telemetry', () => ({
  createLogger: () => mockLogger,
  configureLogging: async () => {},
  initTelemetry: async () => {},
  shutdownTelemetry: async () => {},
  circuitBreakerTrips: noOpCounter,
  cacheHits: noOpCounter,
  cacheMisses: noOpCounter,
  cacheHitRate: noOpCounter,
  redisFallbacks: noOpCounter,
  redirectTotal: noOpCounter,
  redirectErrors: noOpCounter,
  redirectLatency: { record: mock(() => {}) },
  stampedeLocksAcquired: noOpCounter,
  stampedeLocksWaited: noOpCounter,
  recordCacheHit: mock(() => {}),
  recordCacheMiss: mock(() => {}),
  recordRedirectMetrics: mock(() => {})
}));

// Mock Redis client
const mockRedis = {
  send: mock(async (command: string, args: string[]) => {
    switch (command) {
      case 'XADD':
        return '1678900000000-0';
      case 'XGROUP':
        return 'OK';
      case 'XREADGROUP':
        // Handle empty case for test
        if (args.some((a) => a.includes('empty'))) {
          return [];
        }
        // Return format: [[stream, [[id, [key, val, ...]]]]]
        return [
          [
            args[args.indexOf('STREAMS') + 1], // Stream name
            [['1678900000000-0', ['test', 'data', 'key1', 'value1']]]
          ]
        ];
      case 'XACK':
        return 1;
      case 'XLEN':
        return 10;
      case 'XINFO':
        if (args[0] === 'STREAM') {
          return ['length', 10, 'radix-tree-keys', 1];
        } else if (args[0] === 'GROUPS') {
          return [['name', 'test-group', 'consumers', 1, 'pending', 0]];
        }
        return [];
      case 'XAUTOCLAIM':
        // Format: [cursor, [messages]]
        return ['0-0', [['1678900000000-0', ['test', 'claimed']]]];
      case 'DEL':
        return 1;
      default:
        return 'OK';
    }
  }),
  getRedisClient: () => mockRedis
};

// Mock only the Redis client layer so the real RedisStream/STREAM_NAMES implementation
// is used while its internal Redis calls go to mockRedis.
mock.module('@urlfy/cache/client', () => ({
  redis: mockRedis,
  getRedisClient: () => mockRedis,
  checkRedisHealth: async () => ({ ok: true }),
  closeRedis: async () => {},
  // Required by @urlfy/cache index re-export (Phase 2 client health state)
  redisHealth: { isHealthy: true, consecutiveFailures: 0, lastError: null }
}));

// Import RedisStream directly from @urlfy/cache/stream (not the local shim).
// This bypasses any mock.module('@/server/lib/redis-stream', ...) registered by
// other test files (e.g. deletion-workflow.test.ts) that have run before this
// file in the same bun test process, preventing module-mock contamination.
const { CONSUMER_GROUPS, RedisStream, STREAM_NAMES } = await import(
  '@urlfy/cache/stream'
);

// Test stream names
const TEST_STREAM = 'test:stream';
const TEST_GROUP = 'test-group';
const TEST_CONSUMER = 'test-consumer';

describe('RedisStream', () => {
  beforeAll(async () => {
    // Clean up test streams before running tests
    try {
      await mockRedis.send('DEL', [TEST_STREAM]);
    } catch {
      // Ignore if stream doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up after tests
    try {
      await mockRedis.send('DEL', [TEST_STREAM]);
    } catch {
      // Ignore errors
    }
  });

  describe('add()', () => {
    it('should add a message to a stream', async () => {
      const messageId = await RedisStream.add(TEST_STREAM, {
        key1: 'value1',
        key2: 'value2'
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
      expect(messageId).toContain('-');
    });

    it('should handle various data types', async () => {
      const messageId = await RedisStream.add(TEST_STREAM, {
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        object: { nested: 'value' }
      });

      expect(messageId).toBeDefined();
    });
  });

  describe('createGroup()', () => {
    it('should create a consumer group', async () => {
      try {
        await RedisStream.createGroup(TEST_STREAM, TEST_GROUP, '$', true);
      } catch (e) {
        console.log('Error in createGroup:', e);
        throw e;
      }
    });

    it('should not throw on duplicate group creation', async () => {
      await RedisStream.createGroup(TEST_STREAM, TEST_GROUP, '$', true);

      // Second call should not throw
      await RedisStream.createGroup(TEST_STREAM, TEST_GROUP, '$', true);
    });
  });

  describe('readGroup()', () => {
    it('should read messages from a stream', async () => {
      // Add test message
      await RedisStream.add(TEST_STREAM, { test: 'data' });

      // Read messages
      const results = await RedisStream.readGroup(
        TEST_GROUP,
        TEST_CONSUMER,
        [TEST_STREAM],
        10,
        null // Non-blocking
      );

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].stream).toBe(TEST_STREAM);
        expect(Array.isArray(results[0].messages)).toBe(true);
      }
    });

    it('should return empty array when no messages', async () => {
      const results = await RedisStream.readGroup(
        TEST_GROUP,
        `${TEST_CONSUMER}-empty`,
        [TEST_STREAM],
        1,
        null
      );
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('ack()', () => {
    it('should acknowledge messages', async () => {
      // Add and read a message
      await RedisStream.add(TEST_STREAM, { test: 'ack' });
      const results = await RedisStream.readGroup(
        TEST_GROUP,
        `${TEST_CONSUMER}-ack`,
        [TEST_STREAM],
        1,
        null
      );

      if (results.length > 0 && results[0].messages.length > 0) {
        const messageId = results[0].messages[0].id;

        const ackCount = await RedisStream.ack(TEST_STREAM, TEST_GROUP, [
          messageId
        ]);

        expect(ackCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return 0 for empty id array', async () => {
      const ackCount = await RedisStream.ack(TEST_STREAM, TEST_GROUP, []);
      expect(ackCount).toBe(0);
    });
  });

  describe('getLength()', () => {
    it('should get stream length', async () => {
      const length = await RedisStream.getLength(TEST_STREAM);

      expect(typeof length).toBe('number');
      expect(length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('info()', () => {
    it('should get stream information', async () => {
      const info = await RedisStream.info(TEST_STREAM);

      expect(typeof info).toBe('object');
      expect(info).not.toBeNull();
    });
  });

  describe('groups()', () => {
    it('should get consumer groups', async () => {
      const groups = await RedisStream.groups(TEST_STREAM);

      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('autoClaim()', () => {
    it('should claim messages from dead consumers', async () => {
      const result = await RedisStream.autoClaim(
        TEST_STREAM,
        TEST_GROUP,
        `${TEST_CONSUMER}-gc`,
        60000, // 1 minute
        '0-0',
        10
      );

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('cursor');
      expect(Array.isArray(result.messages)).toBe(true);
      expect(typeof result.cursor).toBe('string');
    });
  });

  describe('STREAM_NAMES', () => {
    it('should have defined stream names', () => {
      expect(STREAM_NAMES.analyticsClicks).toBe('analytics:clicks');
      expect(STREAM_NAMES.analyticsDead).toBe('analytics:dead');
      expect(STREAM_NAMES.aggregation).toBe('aggregation');
      expect(STREAM_NAMES.cleanup).toBe('cleanup');
      expect(STREAM_NAMES.deletion).toBe('deletion');
    });
  });

  describe('CONSUMER_GROUPS', () => {
    it('should have defined consumer groups', () => {
      expect(CONSUMER_GROUPS.analytics).toBe('analytics-group');
      expect(CONSUMER_GROUPS.analyticsDead).toBe('analytics-dead-group');
      expect(CONSUMER_GROUPS.aggregation).toBe('aggregation-group');
      expect(CONSUMER_GROUPS.cleanup).toBe('cleanup-group');
      expect(CONSUMER_GROUPS.deletion).toBe('deletion-group');
    });
  });
});
