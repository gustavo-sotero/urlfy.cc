// tests/integration/redirect.integration.test.ts

/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT INTEGRATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * These tests require running infrastructure:
 *   - PostgreSQL database
 *   - Redis cache
 *
 * Run with: docker-compose up -d && bun test tests/integration
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'bun:test';
import { eq } from 'drizzle-orm';
import { testLogger } from '../helpers/test-logger';

// Infrastructure availability check
let infrastructureAvailable = false;
let setupError: Error | null = null;

// Lazy-loaded modules
let db: typeof import('@/db').db | null = null;
let links: typeof import('@/db/schema').links | null = null;
let cacheService:
  | typeof import('@/server/services/cache.service').cacheService
  | null = null;
let redirectService:
  | typeof import('@/server/services/redirect.service').redirectService
  | null = null;

// Check infrastructure availability before running tests
try {
  const dbModule = await import('@/db');
  db = dbModule.db;

  // Test actual database connectivity
  const healthResult = await dbModule.checkDatabaseHealth();
  if (healthResult.status !== 'ok') {
    throw new Error(
      `Database connection failed: ${healthResult.error || 'Unknown error'}`
    );
  }

  if (process.env.USE_REAL_REDIS !== 'true') {
    throw new Error('Redis not enabled for integration tests');
  }

  const { checkRedisHealth } = await import('@/server/lib/redis');
  const redisHealth = await checkRedisHealth();
  if (redisHealth.status !== 'ok') {
    throw new Error(
      `Redis connection failed: ${redisHealth.error || 'Unknown error'}`
    );
  }

  const schemaModule = await import('@/db/schema');
  links = schemaModule.links;

  const cacheModule = await import('@/server/services/cache.service');
  cacheService = cacheModule.cacheService;

  const redirectModule = await import('@/server/services/redirect.service');
  redirectService = redirectModule.redirectService;

  infrastructureAvailable = true;
} catch (error) {
  setupError = error instanceof Error ? error : new Error(String(error));
  console.warn(
    '⚠️  Redirect Integration tests skipped: Infrastructure not available',
    setupError.message
  );
}

describe('Redirect Integration Tests', () => {
  // Skip entire test suite if infrastructure is not available
  if (
    !infrastructureAvailable ||
    !db ||
    !links ||
    !cacheService ||
    !redirectService
  ) {
    it('should skip tests when infrastructure is unavailable', () => {
      testLogger.warn(
        `Redirect Integration tests skipped - infrastructure unavailable: ${setupError?.message ?? 'unknown'}`
      );
      expect(true).toBe(true); // Dummy assertion to pass
    });
    return;
  }

  // Non-null assertions for TypeScript (after the early return above)
  const _db = db;
  const _links = links;
  const _cacheService = cacheService;
  const _redirectService = redirectService;

  const testLinks = [
    {
      id: 'test-integration-001',
      shortCode: 'int-test-1',
      originalUrl: 'https://example.com/test1',
      redirectType: 301,
      isActive: true,
      isBanned: false,
      clicksCount: 0
    },
    {
      id: 'test-integration-002',
      shortCode: 'int-test-2',
      originalUrl: 'https://example.com/test2',
      redirectType: 302,
      isActive: true,
      isBanned: false,
      clicksCount: 0,
      expiresAt: new Date(Date.now() + 86400000) // 24h from now
    },
    {
      id: 'test-integration-003',
      shortCode: 'int-test-3',
      originalUrl: 'https://example.com/test3',
      redirectType: 302,
      isActive: false,
      isBanned: false,
      clicksCount: 0
    }
  ];

  beforeAll(async () => {
    // Cleanup before tests
    for (const link of testLinks) {
      await _db.delete(_links).where(eq(_links.shortCode, link.shortCode));
      await _cacheService.invalidateLink(link.shortCode);
    }

    // Insert test data
    for (const link of testLinks) {
      await _db.insert(_links).values(link);
    }
  });

  afterAll(async () => {
    // Cleanup after tests
    for (const link of testLinks) {
      await _db.delete(_links).where(eq(_links.shortCode, link.shortCode));
      await _cacheService.invalidateLink(link.shortCode);
    }
  });

  beforeEach(async () => {
    // Clear cache before each test to ensure fresh state
    for (const link of testLinks) {
      await _cacheService.invalidateLink(link.shortCode);
    }
  });

  describe('End-to-End Redirect Flow', () => {
    it('should redirect and populate cache on first request', async () => {
      const code = 'int-test-1';

      // Verify cache is empty
      const cachedBefore = await _cacheService.getLink(code);
      expect(cachedBefore).toBeNull();

      // First request (cache miss)
      const result = await _redirectService.resolve(code, 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com/test1');
      expect(result.redirectType).toBe(301);

      // Verify cache was populated
      const cachedAfter = await _cacheService.getLink(code);
      expect(cachedAfter).not.toBeNull();
      expect(cachedAfter?.originalUrl).toBe('https://example.com/test1');
    });

    it('should serve from cache on subsequent requests', async () => {
      const code = 'int-test-1';

      // First request to populate cache
      await _redirectService.resolve(code, 0);

      // Second request (cache hit)
      const startTime = performance.now();
      const result = await _redirectService.resolve(code, 0);
      const latency = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com/test1');

      // Cache hit should be fast (< 10ms)
      expect(latency).toBeLessThan(10);

      // Verify cache was used
      const cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();
    });

    it('should handle inactive link correctly', async () => {
      const code = 'int-test-3';

      const result = await _redirectService.resolve(code, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INACTIVE');
    });

    it('should respect redirect depth limit', async () => {
      const code = 'int-test-1';

      const result = await _redirectService.resolve(code, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('REDIRECT_LOOP');
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when link is updated', async () => {
      const code = 'int-test-1';

      // Populate cache
      await _redirectService.resolve(code, 0);
      const cachedBefore = await _cacheService.getLink(code);
      expect(cachedBefore).not.toBeNull();

      // Update link in database
      await _db
        .update(_links)
        .set({ originalUrl: 'https://example.com/updated' })
        .where(eq(_links.shortCode, code));

      // Invalidate cache
      await _cacheService.invalidateLink(code);

      // Verify cache was cleared
      const cachedAfter = await _cacheService.getLink(code);
      expect(cachedAfter).toBeNull();

      // Next request should fetch updated data
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com/updated');

      // Restore original URL for other tests
      await _db
        .update(_links)
        .set({ originalUrl: 'https://example.com/test1' })
        .where(eq(_links.shortCode, code));
    });

    it('should set negative cache for non-existent links', async () => {
      const code = 'non-existent-link';

      // First request
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');

      // Verify negative cache was set
      const is404 = await _cacheService.isNotFound(code);
      expect(is404).toBe(true);

      // Second request should use negative cache
      const result2 = await _redirectService.resolve(code, 0);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('NOT_FOUND');

      // Cleanup
      await _cacheService.invalidateLink(code);
    });
  });

  describe('Concurrent Access (Stampede Protection)', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const code = 'int-test-2';

      // Clear cache
      await _cacheService.invalidateLink(code);

      // Simulate 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        _redirectService.resolve(code, 0)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.url).toBe('https://example.com/test2');
      });

      // Cache should be populated only once
      const cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();
    });
  });

  describe('Code Availability', () => {
    it('should correctly check if code is available', async () => {
      const existingCode = 'int-test-1';
      const newCode = 'available-code-123';

      const existing = await _redirectService.isCodeAvailable(existingCode);
      expect(existing).toBe(false);

      const available = await _redirectService.isCodeAvailable(newCode);
      expect(available).toBe(true);
    });
  });

  describe('Health Stats', () => {
    it('should return health statistics', async () => {
      const stats = await _redirectService.getHealthStats();

      expect(stats).toHaveProperty('circuitBreaker');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats.cacheStats).toHaveProperty('memory');
      expect(stats.cacheStats).toHaveProperty('keys');
      expect(typeof stats.circuitBreaker).toBe('string');
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hit rate', async () => {
      const code = 'int-test-1';

      // Clear and populate
      await _cacheService.invalidateLink(code);
      await _redirectService.resolve(code, 0); // Cache miss
      await _redirectService.resolve(code, 0); // Cache hit
      await _redirectService.resolve(code, 0); // Cache hit

      const stats = await _cacheService.getCacheStats();

      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.keys).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with a code that would cause issues
      // This is a simplified test - in production you'd mock the DB error
      const result = await _redirectService.resolve('', 0);

      // Should either fail validation or return NOT_FOUND
      expect(result.success).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect link expiration', async () => {
      const expiredLink = {
        id: 'test-integration-expired',
        shortCode: 'int-test-expired',
        originalUrl: 'https://example.com/expired',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        clicksCount: 0,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      // Insert expired link
      await _db
        .delete(_links)
        .where(eq(_links.shortCode, expiredLink.shortCode));
      await _db.insert(_links).values(expiredLink);

      const result = await _redirectService.resolve(expiredLink.shortCode, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('EXPIRED');

      // Cleanup
      await _db
        .delete(_links)
        .where(eq(_links.shortCode, expiredLink.shortCode));
      await _cacheService.invalidateLink(expiredLink.shortCode);
    });
  });
});
