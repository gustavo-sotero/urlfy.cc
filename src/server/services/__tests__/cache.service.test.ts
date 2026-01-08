// src/server/services/__tests__/cache.service.test.ts

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CachedLink } from "@/types/redirect.types";
import { CACHE_PREFIX, CACHE_TTL, cacheService } from "../cache.service";

// Mock Redis client
const mockRedis = {
  get: mock<() => Promise<string | null>>(() => Promise.resolve(null)),
  setex: mock(() => Promise.resolve("OK")),
  set: mock(() => Promise.resolve("OK")),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  keys: mock<() => Promise<string[]>>(() => Promise.resolve([])),
  pipeline: mock(() => ({
    del: mock(),
    exec: mock(() => Promise.resolve([])),
  })),
  info: mock(() => Promise.resolve("")),
  dbsize: mock(() => Promise.resolve(0)),
  flushall: mock(() => Promise.resolve("OK")),
};

// Mock module
mock.module("@/server/lib/redis", () => ({
  getRedisClient: () => mockRedis,
}));

describe("CacheService", () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockRedis).forEach((mockFn) => {
      if (typeof mockFn.mockReset === "function") {
        mockFn.mockReset();
      }
    });
  });

  describe("getLink()", () => {
    it("should return null on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.getLink("abc123");

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(`${CACHE_PREFIX.LINK}abc123`);
    });

    it("should return parsed link on cache hit", async () => {
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

      mockRedis.get.mockResolvedValue(JSON.stringify(mockLink));

      const result = await cacheService.getLink("abc123");

      expect(result).toEqual(mockLink);
    });

    it("should return null on parse error", async () => {
      mockRedis.get.mockResolvedValue("invalid-json");

      const result = await cacheService.getLink("abc123");

      expect(result).toBeNull();
    });

    it("should return null on Redis error", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.getLink("abc123");

      expect(result).toBeNull();
    });
  });

  describe("setLink()", () => {
    it("should cache link with correct TTL", async () => {
      const mockLink: CachedLink = {
        id: "test-id-002",
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

      await cacheService.setLink("abc123", mockLink);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK}abc123`,
        CACHE_TTL.LINK,
        JSON.stringify(mockLink),
      );
    });
  });

  describe("isNotFound()", () => {
    it("should return true if 404 cache exists", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.isNotFound("notfound");

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_404}notfound`,
      );
    });

    it("should return false if 404 cache does not exist", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.isNotFound("exists");

      expect(result).toBe(false);
    });

    it("should return false on Redis error", async () => {
      mockRedis.exists.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.isNotFound("error");

      expect(result).toBe(false);
    });
  });

  describe("setNotFound()", () => {
    it("should cache 404 with negative TTL", async () => {
      await cacheService.setNotFound("notfound");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_404}notfound`,
        CACHE_TTL.NEGATIVE,
        "1",
      );
    });
  });

  describe("isBanned()", () => {
    it("should return true if banned cache exists", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.isBanned("banned");

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_BANNED}banned`,
      );
    });

    it("should return false if banned cache does not exist", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.isBanned("clean");

      expect(result).toBe(false);
    });
  });

  describe("setBanned()", () => {
    it("should cache banned link with correct TTL", async () => {
      await cacheService.setBanned("banned");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_BANNED}banned`,
        CACHE_TTL.BANNED,
        "1",
      );
    });
  });

  describe("invalidateLink()", () => {
    it("should delete all related cache entries", async () => {
      const mockPipeline = {
        del: mock(),
        exec: mock(() => Promise.resolve([])),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.keys.mockResolvedValue([
        "qr:abc123:200:png",
        "qr:abc123:400:svg",
      ]);

      await cacheService.invalidateLink("abc123");

      expect(mockPipeline.del).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK}abc123`,
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_META}abc123`,
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_404}abc123`,
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_BANNED}abc123`,
      );
      expect(mockRedis.keys).toHaveBeenCalledWith(
        `${CACHE_PREFIX.QR_CODE}abc123:*`,
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it("should handle case with no QR codes", async () => {
      const mockPipeline = {
        del: mock(),
        exec: mock(() => Promise.resolve([])),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.invalidateLink("no-qr");

      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe("invalidateAndBan()", () => {
    it("should invalidate and mark as banned", async () => {
      const mockPipeline = {
        del: mock(),
        exec: mock(() => Promise.resolve([])),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.invalidateAndBan("malicious");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_BANNED}malicious`,
        CACHE_TTL.BANNED,
        "1",
      );
    });
  });

  describe("invalidateAndMarkDeleted()", () => {
    it("should invalidate and mark as not found", async () => {
      const mockPipeline = {
        del: mock(),
        exec: mock(() => Promise.resolve([])),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.invalidateAndMarkDeleted("deleted");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK_404}deleted`,
        CACHE_TTL.NEGATIVE,
        "1",
      );
    });
  });

  describe("getCacheStats()", () => {
    it("should return cache statistics", async () => {
      mockRedis.info.mockResolvedValue(
        "# Stats\r\nkeyspace_hits:1000\r\nkeyspace_misses:100\r\n# Memory\r\nused_memory_human:1.5M\r\n",
      );
      mockRedis.dbsize.mockResolvedValue(500);

      const stats = await cacheService.getCacheStats();

      expect(stats.memory).toBe("1.5M");
      expect(stats.keys).toBe(500);
      expect(stats.hitRate).toBeCloseTo(90.91, 1);
    });

    it("should handle zero hits/misses", async () => {
      mockRedis.info.mockResolvedValue("# Stats\r\n# Memory\r\n");
      mockRedis.dbsize.mockResolvedValue(0);

      const stats = await cacheService.getCacheStats();

      expect(stats.hitRate).toBeNull();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedis.info.mockRejectedValue(new Error("Redis error"));
      mockRedis.dbsize.mockRejectedValue(new Error("Redis error"));

      const stats = await cacheService.getCacheStats();

      expect(stats.memory).toBe("unknown");
      expect(stats.keys).toBe(0);
      expect(stats.hitRate).toBeNull();
    });
  });

  describe("flushLinks()", () => {
    it("should delete all link-related keys", async () => {
      mockRedis.keys
        .mockResolvedValueOnce(["link:abc", "link:def"])
        .mockResolvedValueOnce(["link:meta:abc"])
        .mockResolvedValueOnce(["link:404:xyz"])
        .mockResolvedValueOnce(["link:banned:bad"]);

      await cacheService.flushLinks();

      expect(mockRedis.keys).toHaveBeenCalledTimes(4);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it("should handle empty patterns", async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.flushLinks();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
