// src/server/services/__tests__/redirect.service.test.ts

// ═══════════════════════════════════════════════════════════════════
// CRITICAL: Set environment variables BEFORE ANY imports
// ═══════════════════════════════════════════════════════════════════
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test-secret-key-for-testing";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CachedLink } from "@/types/redirect.types";

// Mock do cache service
const mockCache = {
  getLink: mock<(code: string) => Promise<CachedLink | null>>(() =>
    Promise.resolve(null),
  ),
  setLink: mock(() => Promise.resolve()),
  isNotFound: mock(() => Promise.resolve(false)),
  setNotFound: mock(() => Promise.resolve()),
  isBanned: mock(() => Promise.resolve(false)),
  setBanned: mock(() => Promise.resolve()),
  invalidateLink: mock(() => Promise.resolve()),
  getCacheStats: mock(() =>
    Promise.resolve({ hits: 0, misses: 0, hitRate: 0 }),
  ),
};

// Mock do database
const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(() => Promise.resolve([])),
      })),
    })),
  })),
  query: {
    links: {
      findFirst: mock<
        (
          args?: Record<string, unknown>,
        ) => Promise<Record<string, unknown> | null>
      >(() => Promise.resolve(null)),
    },
  },
};

// Mock do circuit breaker
const mockCircuitBreaker = {
  execute: mock(<T>(fn: () => Promise<T>) => fn()),
  getStatus: mock(() => "CLOSED"),
};

// Mock distributed lock
const mockLock = {
  acquireLock: mock(() => Promise.resolve(true)),
  releaseLock: mock(() => Promise.resolve()),
};

// Mock telemetry
const mockTelemetry = {
  createLogger: mock(() => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  })),
  cacheHits: { add: mock(() => {}) },
  cacheMisses: { add: mock(() => {}) },
  redisFallbacks: { add: mock(() => {}) },
  recordRedirectMetrics: mock(() => {}),
  stampedeLocksAcquired: { add: mock(() => {}) },
  stampedeLocksWaited: { add: mock(() => {}) },
};

// Mock modules BEFORE importing service
mock.module("@/server/services/cache.service", () => ({
  cacheService: mockCache,
  CACHE_PREFIX: {
    LINK: "link:",
    NOT_FOUND: "link:404:",
    BANNED: "link:banned:",
    LOCK: "lock:link:",
  },
}));

mock.module("@/db", () => ({
  db: mockDb,
}));

mock.module("@/db/schema", () => ({
  links: {
    id: "id",
    shortCode: "short_code",
    originalUrl: "original_url",
  },
}));

mock.module("@/server/lib/circuit-breaker", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    execute = mockCircuitBreaker.execute;
    getStatus = mockCircuitBreaker.getStatus;
  },
}));

mock.module("@/server/lib/distributed-lock", () => ({
  acquireLock: mockLock.acquireLock,
  releaseLock: mockLock.releaseLock,
}));

mock.module("@/server/lib/telemetry", () => mockTelemetry);

mock.module("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: (
        _name: string,
        _opts: unknown,
        fn: (span: unknown) => unknown,
      ) => {
        const mockSpan = {
          setStatus: mock(() => {}),
          setAttributes: mock(() => {}),
          setAttribute: mock(() => {}),
          recordException: mock(() => {}),
          end: mock(() => {}),
        };
        return fn(mockSpan);
      },
    }),
  },
}));

// NOW import the service
import { RedirectService } from "../redirect.service";

// Create service instance
const redirectService = new RedirectService();

describe("RedirectService", () => {
  beforeEach(() => {
    // Reset all mocks
    mockCache.getLink.mockReset();
    mockCache.setLink.mockReset();
    mockCache.isNotFound.mockReset();
    mockCache.setNotFound.mockReset();
    mockCache.isBanned.mockReset();
    mockDb.query.links.findFirst.mockReset();
  });

  describe("resolve()", () => {
    it("should return URL for valid active link from cache", async () => {
      const mockLink: CachedLink = {
        id: "test-id-001",
        originalUrl: "https://example.com",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("abc123", 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com");
      expect(result.redirectType).toBe(301);
      expect(mockCache.getLink).toHaveBeenCalledWith("abc123");
    });

    it("should return REDIRECT_LOOP when depth >= 3", async () => {
      const result = await redirectService.resolve("abc123", 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe("REDIRECT_LOOP");
    });

    it("should return NOT_FOUND when link does not exist", async () => {
      mockCache.isNotFound.mockResolvedValue(false);
      mockCache.getLink.mockResolvedValue(null);
      mockDb.query.links.findFirst.mockResolvedValue(null);

      const result = await redirectService.resolve("nonexistent", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
    });

    it("should return NOT_FOUND from negative cache", async () => {
      mockCache.isNotFound.mockResolvedValue(true);

      const result = await redirectService.resolve("notfound", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
      expect(mockCache.getLink).not.toHaveBeenCalled();
    });

    it("should return INACTIVE for inactive link", async () => {
      const mockLink: CachedLink = {
        id: "test-id-002",
        originalUrl: "https://example.com",
        redirectType: 302,
        isActive: false,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("inactive", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INACTIVE");
    });

    it("should return BANNED for banned link", async () => {
      mockCache.isBanned.mockResolvedValue(true);

      const result = await redirectService.resolve("banned", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("BANNED");
    });

    it("should return EXPIRED for expired link", async () => {
      const mockLink: CachedLink = {
        id: "test-id-003",
        originalUrl: "https://example.com",
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: new Date("2020-01-01").toISOString(),
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("expired", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("EXPIRED");
    });

    it("should return MAX_CLICKS when limit reached", async () => {
      const mockLink: CachedLink = {
        id: "test-id-004",
        originalUrl: "https://example.com",
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: 100,
        clicksCount: 100,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("maxed", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MAX_CLICKS");
    });

    it("should return PASSWORD_REQUIRED for password-protected link", async () => {
      const mockLink: CachedLink = {
        id: "test-id-005",
        originalUrl: "https://example.com",
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: "$2b$10$hashedpassword",
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("protected", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("PASSWORD_REQUIRED");
    });

    it("should append UTM parameters to URL", async () => {
      const mockLink: CachedLink = {
        id: "test-id-006",
        originalUrl: "https://example.com",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "launch",
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("with-utm", 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain("utm_source=twitter");
      expect(result.url).toContain("utm_medium=social");
      expect(result.url).toContain("utm_campaign=launch");
    });

    it("should preserve existing query parameters in URL", async () => {
      const mockLink: CachedLink = {
        id: "test-id-007",
        originalUrl: "https://example.com?existing=param",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: "email",
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("with-query", 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain("existing=param");
      expect(result.url).toContain("utm_source=email");
    });
  });

  describe("isCodeAvailable()", () => {
    it("should return false if code exists in cache", async () => {
      const mockLink: CachedLink = {
        id: "test-id-008",
        originalUrl: "https://example.com",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.isCodeAvailable("taken");

      expect(result).toBe(false);
    });

    it("should return false if code exists in database", async () => {
      mockCache.getLink.mockResolvedValue(null);
      mockDb.query.links.findFirst.mockResolvedValue({
        id: "test-id-009",
      });

      const result = await redirectService.isCodeAvailable("taken-db");

      expect(result).toBe(false);
    });

    it("should return true if code is available", async () => {
      mockCache.getLink.mockResolvedValue(null);
      mockDb.query.links.findFirst.mockResolvedValue(null);

      const result = await redirectService.isCodeAvailable("available");

      expect(result).toBe(true);
    });
  });

  describe("getHealthStats()", () => {
    it("should return health statistics", async () => {
      const stats = await redirectService.getHealthStats();

      expect(stats).toHaveProperty("circuitBreaker");
      expect(stats).toHaveProperty("cacheStats");
      expect(typeof stats.circuitBreaker).toBe("string");
    });
  });

  describe("Edge Cases", () => {
    it("should handle URLs with special characters", async () => {
      const mockLink: CachedLink = {
        id: "test-id-010",
        originalUrl: "https://example.com/path?query=value&other=123",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("special", 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe(mockLink.originalUrl);
    });

    it("should handle URL building errors gracefully", async () => {
      const mockLink: CachedLink = {
        id: "test-id-011",
        originalUrl: "not-a-valid-url",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: "test",
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("invalid-url", 0);

      // Should return original URL even if invalid
      expect(result.success).toBe(true);
      expect(result.url).toBe(mockLink.originalUrl);
    });

    it("should allow clicks up to maxClicks (not exceed)", async () => {
      const mockLink: CachedLink = {
        id: "test-id-012",
        originalUrl: "https://example.com",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: 100,
        clicksCount: 99, // One click remaining
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      const result = await redirectService.resolve("almost-maxed", 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com");
    });

    it("should handle expiration at exact time boundary", async () => {
      const now = new Date();
      const mockLink: CachedLink = {
        id: "test-id-013",
        originalUrl: "https://example.com",
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: now.toISOString(),
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      };

      mockCache.getLink.mockResolvedValue(mockLink);

      // Should be expired (current time >= expiresAt)
      const result = await redirectService.resolve("boundary", 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("EXPIRED");
    });
  });
});
