// tests/integration/redirect-comprehensive.integration.test.ts

/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT ENGINE - COMPREHENSIVE INTEGRATION TESTS
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
    '⚠️  Redirect Comprehensive tests skipped: Infrastructure not available',
    setupError.message
  );
}

describe('Redirect Engine - Comprehensive Integration Tests', () => {
  // Skip entire test suite if infrastructure is not available
  if (
    !infrastructureAvailable ||
    !db ||
    !links ||
    !cacheService ||
    !redirectService
  ) {
    it('should skip tests when infrastructure is unavailable', () => {
      console.log(
        '⚠️  Redirect Comprehensive tests skipped - infrastructure unavailable:',
        setupError?.message
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
      id: 'comprehensive-test-001',
      shortCode: 'comp-test-001',
      originalUrl: 'https://example.com/target',
      redirectType: 301,
      isActive: true,
      isBanned: false,
      clicksCount: 0
    },
    {
      id: 'comprehensive-test-002',
      shortCode: 'comp-test-002',
      originalUrl: 'https://example.com/utm?existing=param',
      redirectType: 302,
      isActive: true,
      isBanned: false,
      clicksCount: 0,
      utmSource: 'direct',
      utmMedium: 'social',
      utmCampaign: 'campaign123'
    },
    {
      id: 'comprehensive-test-003',
      shortCode: 'comp-test-003',
      originalUrl: 'https://example.com/inactive',
      redirectType: 301,
      isActive: false,
      isBanned: false,
      clicksCount: 0
    },
    {
      id: 'comprehensive-test-004',
      shortCode: 'comp-test-004',
      originalUrl: 'https://example.com/banned',
      redirectType: 301,
      isActive: true,
      isBanned: true,
      clicksCount: 0
    },
    {
      id: 'comprehensive-test-005',
      shortCode: 'comp-test-005',
      originalUrl: 'https://example.com/max-clicks',
      redirectType: 301,
      isActive: true,
      isBanned: false,
      clicksCount: 5,
      maxClicks: 5
    }
  ];

  beforeAll(async () => {
    // Cleanup and setup
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
    // Cleanup
    for (const link of testLinks) {
      await _db.delete(_links).where(eq(_links.shortCode, link.shortCode));
      await _cacheService.invalidateLink(link.shortCode);
    }
  });

  beforeEach(async () => {
    // Clear cache before each test
    for (const link of testLinks) {
      await _cacheService.invalidateLink(link.shortCode);
    }
  });

  describe('Cache-Aside Pattern', () => {
    it('should populate cache on first access (cache miss)', async () => {
      const code = 'comp-test-001';

      // Verify cache is empty
      let cached = await _cacheService.getLink(code);
      expect(cached).toBeNull();

      // First access
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(true);

      // Cache should now be populated
      cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();
      expect(cached?.originalUrl).toBe('https://example.com/target');
    });

    it('should serve from cache on subsequent accesses (cache hit)', async () => {
      const code = 'comp-test-001';

      // First request (populate cache)
      await _redirectService.resolve(code, 0);

      // Second request (should hit cache)
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(true);

      // Verify cache still exists
      const cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();
    });

    it('should invalidate cache after link update', async () => {
      const code = 'comp-test-001';

      // Populate cache
      await _redirectService.resolve(code, 0);
      let cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();

      // Invalidate cache (simulating an update)
      await _cacheService.invalidateLink(code);

      // Cache should be cleared
      cached = await _cacheService.getLink(code);
      expect(cached).toBeNull();
    });

    it('should use negative cache for non-existent links', async () => {
      const code = 'comp-test-nonexistent';

      // First request (cache miss, then negative cache)
      let result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');

      // Check negative cache
      const isNotFound = await _cacheService.isNotFound(code);
      expect(isNotFound).toBe(true);

      // Second request should use negative cache
      result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });
  });

  describe('Validation Pipeline', () => {
    it('should return INACTIVE for inactive links', async () => {
      const result = await _redirectService.resolve('comp-test-003', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INACTIVE');
    });

    it('should return BANNED for banned links', async () => {
      const result = await _redirectService.resolve('comp-test-004', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('BANNED');
    });

    it('should return MAX_CLICKS when limit reached', async () => {
      const result = await _redirectService.resolve('comp-test-005', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MAX_CLICKS');
    });

    it('should return REDIRECT_LOOP at depth >= 3', async () => {
      const result = await _redirectService.resolve('comp-test-001', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('REDIRECT_LOOP');
    });
  });

  describe('UTM Parameter Handling', () => {
    it('should append UTM parameters to destination URL', async () => {
      const result = await _redirectService.resolve('comp-test-002', 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain('utm_source=direct');
      expect(result.url).toContain('utm_medium=social');
      expect(result.url).toContain('utm_campaign=campaign123');
    });

    it('should preserve existing query parameters', async () => {
      const result = await _redirectService.resolve('comp-test-002', 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain('existing=param');
    });
  });

  describe('Redirect Type Selection', () => {
    it('should use 301 redirect type when specified', async () => {
      const result = await _redirectService.resolve('comp-test-001', 0);

      expect(result.success).toBe(true);
      expect(result.redirectType).toBe(301);
    });

    it('should use 302 redirect type when specified', async () => {
      const result = await _redirectService.resolve('comp-test-002', 0);

      expect(result.success).toBe(true);
      expect(result.redirectType).toBe(302);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed URLs gracefully', async () => {
      // Test with empty code
      let result = await _redirectService.resolve('', 0);
      expect(result.success).toBe(false);

      // Test with very long code
      result = await _redirectService.resolve('x'.repeat(100), 0);
      expect(result.success).toBe(false);
    });

    it('should check link availability independently', async () => {
      const available = await _redirectService.isCodeAvailable('comp-test-001');
      expect(available).toBe(false);

      const notAvailable = await _redirectService.isCodeAvailable(
        'definitely-not-used'
      );
      expect(notAvailable).toBe(true);
    });
  });

  describe('Health and Metrics', () => {
    it('should provide health statistics', async () => {
      const stats = await _redirectService.getHealthStats();

      expect(stats).toHaveProperty('circuitBreaker');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats.cacheStats).toHaveProperty('memory');
      expect(stats.cacheStats).toHaveProperty('keys');
    });
  });

  describe('Cache Stampede Protection', () => {
    it('should handle concurrent requests for uncached link', async () => {
      const code = 'comp-test-concurrent';

      // Insert a test link
      const testLink = {
        id: 'concurrent-test',
        shortCode: code,
        originalUrl: 'https://example.com/concurrent',
        redirectType: 301,
        isActive: true,
        isBanned: false,
        clicksCount: 0
      };

      await _db.insert(_links).values(testLink);

      try {
        // Simulate concurrent requests
        const promises = [
          _redirectService.resolve(code, 0),
          _redirectService.resolve(code, 0),
          _redirectService.resolve(code, 0),
          _redirectService.resolve(code, 0),
          _redirectService.resolve(code, 0)
        ];

        const results = await Promise.all(promises);

        // All should succeed
        results.forEach((result) => {
          expect(result.success).toBe(true);
          expect(result.url).toBe('https://example.com/concurrent');
        });

        // Cache should be populated
        const cached = await _cacheService.getLink(code);
        expect(cached).not.toBeNull();
      } finally {
        // Cleanup
        await _db.delete(_links).where(eq(_links.shortCode, code));
        await _cacheService.invalidateLink(code);
      }
    });
  });

  describe('Cache Invalidation Scenarios', () => {
    it('should clear cache and marked deleted cache entry', async () => {
      const code = 'comp-test-001';

      // Populate cache
      await _redirectService.resolve(code, 0);
      const cached = await _cacheService.getLink(code);
      expect(cached).not.toBeNull();

      // Invalidate and mark as deleted
      await _cacheService.invalidateAndMarkDeleted(code);

      // Should be in negative cache
      const isNotFound = await _cacheService.isNotFound(code);
      expect(isNotFound).toBe(true);

      // Try to resolve
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });

    it('should clear cache and mark as banned', async () => {
      const code = 'comp-test-001';

      // Populate cache
      await _redirectService.resolve(code, 0);

      // Invalidate and ban
      await _cacheService.invalidateAndBan(code);

      // Should be in banned cache
      const isBanned = await _cacheService.isBanned(code);
      expect(isBanned).toBe(true);

      // Try to resolve
      const result = await _redirectService.resolve(code, 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('BANNED');
    });
  });
});
