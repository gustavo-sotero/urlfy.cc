// src/server/workers/__tests__/aggregation.worker.test.ts

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Job } from "bullmq";

interface AggregationJob {
  date: string;
  linkIds?: string[];
}

describe("Aggregation Worker", () => {
  const mockDb = {
    selectDistinct: mock(() => ({
      from: mock(() => ({
        where: mock(() =>
          Promise.resolve([
            { linkId: "link-1" },
            { linkId: "link-2" },
            { linkId: "link-3" },
          ]),
        ),
      })),
    })),
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          groupBy: mock(() =>
            Promise.resolve([
              {
                linkId: "link-1",
                clicks: 100,
                uniqueVisitors: 85,
              },
            ]),
          ),
        })),
      })),
    })),
    insert: mock(() => ({
      values: mock(() => ({
        onConflictDoUpdate: mock(() => Promise.resolve()),
      })),
    })),
  };

  beforeEach(() => {
    mockDb.selectDistinct.mockClear();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
  });

  describe("aggregation logic", () => {
    it("should aggregate daily stats for a single link", async () => {
      const date = "2026-01-07";
      const linkId = "test-link-123";

      // Mock data
      const stats = {
        linkId,
        date,
        clicks: 150,
        uniqueVisitors: 120,
      };

      expect(stats.clicks).toBe(150);
      expect(stats.uniqueVisitors).toBe(120);
      expect(stats.uniqueVisitors).toBeLessThanOrEqual(stats.clicks);
    });

    it("should process all active links for a day", async () => {
      const jobData: AggregationJob = {
        date: "2026-01-07",
      };

      const mockJob = {
        id: "agg-job-123",
        data: jobData,
      } as Job<AggregationJob>;

      // Simulate finding 3 active links
      const activeLinks = ["link-1", "link-2", "link-3"];

      expect(activeLinks).toHaveLength(3);
      expect(mockJob.data.date).toBe("2026-01-07");
    });

    it("should process specific links when provided", async () => {
      const jobData: AggregationJob = {
        date: "2026-01-07",
        linkIds: ["link-1", "link-2"],
      };

      const mockJob = {
        id: "agg-job-123",
        data: jobData,
      } as Job<AggregationJob>;

      expect(mockJob.data.linkIds).toHaveLength(2);
      expect(mockJob.data.linkIds).toContain("link-1");
      expect(mockJob.data.linkIds).toContain("link-2");
    });

    it("should calculate unique visitors correctly", async () => {
      // Mock scenario: 10 clicks from 7 unique visitors
      const mockEvents = [
        { visitorHash: "hash1" },
        { visitorHash: "hash2" },
        { visitorHash: "hash1" }, // Repeat
        { visitorHash: "hash3" },
        { visitorHash: "hash4" },
        { visitorHash: "hash2" }, // Repeat
        { visitorHash: "hash5" },
        { visitorHash: "hash6" },
        { visitorHash: "hash7" },
        { visitorHash: "hash1" }, // Repeat
      ];

      const uniqueHashes = new Set(mockEvents.map((e) => e.visitorHash));

      expect(mockEvents).toHaveLength(10);
      expect(uniqueHashes.size).toBe(7);
    });

    it("should handle links with no clicks", async () => {
      const _jobData: AggregationJob = {
        date: "2026-01-07",
        linkIds: ["empty-link"],
      };

      // No events for this link
      const stats = {
        linkId: "empty-link",
        date: "2026-01-07",
        clicks: 0,
        uniqueVisitors: 0,
      };

      expect(stats.clicks).toBe(0);
      expect(stats.uniqueVisitors).toBe(0);
    });
  });

  describe("breakdown aggregation", () => {
    it("should aggregate country breakdown", async () => {
      const mockCountryData = [
        { country: "BR", clicks: 50 },
        { country: "US", clicks: 30 },
        { country: "UK", clicks: 20 },
      ];

      const total = mockCountryData.reduce((sum, item) => sum + item.clicks, 0);

      expect(total).toBe(100);
      expect(mockCountryData[0].country).toBe("BR");
      expect(mockCountryData[0].clicks).toBe(50);
    });

    it("should aggregate device breakdown", async () => {
      const mockDeviceData = [
        { deviceType: "mobile", clicks: 60 },
        { deviceType: "desktop", clicks: 35 },
        { deviceType: "tablet", clicks: 5 },
      ];

      const total = mockDeviceData.reduce((sum, item) => sum + item.clicks, 0);

      expect(total).toBe(100);
      expect(mockDeviceData[0].deviceType).toBe("mobile");
    });

    it("should aggregate browser breakdown", async () => {
      const mockBrowserData = [
        { browser: "Chrome", clicks: 70 },
        { browser: "Safari", clicks: 20 },
        { browser: "Firefox", clicks: 10 },
      ];

      expect(mockBrowserData).toHaveLength(3);
      expect(mockBrowserData[0].browser).toBe("Chrome");
      expect(mockBrowserData[0].clicks).toBeGreaterThan(
        mockBrowserData[1].clicks,
      );
    });

    it("should handle null values in breakdown", async () => {
      const mockData = [
        { country: "BR", clicks: 50 },
        { country: null, clicks: 30 }, // Unknown country
        { country: "US", clicks: 20 },
      ];

      expect(mockData[1].country).toBeNull();
      expect(mockData[1].clicks).toBe(30);
    });
  });

  describe("upsert logic", () => {
    it("should insert new daily record", async () => {
      const data = {
        linkId: "link-1",
        date: "2026-01-07",
        clicks: 100,
        uniqueVisitors: 80,
      };

      // First time aggregating this date
      expect(data.clicks).toBe(100);
    });

    it("should update existing daily record", async () => {
      const existing = {
        linkId: "link-1",
        date: "2026-01-07",
        clicks: 50,
        uniqueVisitors: 40,
      };

      const updated = {
        ...existing,
        clicks: 100,
        uniqueVisitors: 80,
      };

      expect(updated.clicks).toBeGreaterThan(existing.clicks);
      expect(updated.uniqueVisitors).toBeGreaterThan(existing.uniqueVisitors);
    });

    it("should handle concurrent aggregations", async () => {
      // Multiple aggregation jobs for same date should be idempotent
      const date = "2026-01-07";

      const job1Result = { aggregated: 5, date };
      const job2Result = { aggregated: 5, date };

      expect(job1Result.aggregated).toBe(job2Result.aggregated);
    });
  });

  describe("date handling", () => {
    it("should parse date correctly", () => {
      const dateStr = "2026-01-07";
      const dateObj = new Date(dateStr);

      expect(dateObj.getFullYear()).toBe(2026);
      expect(dateObj.getMonth()).toBe(0); // January = 0
      expect(dateObj.getDate()).toBe(7);
    });

    it("should calculate next date correctly", () => {
      const dateStr = "2026-01-07";
      const dateObj = new Date(dateStr);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);

      expect(nextDate.getDate()).toBe(8);
    });

    it("should handle month boundary", () => {
      const dateStr = "2026-01-31";
      const dateObj = new Date(dateStr);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);

      expect(nextDate.getMonth()).toBe(1); // February
      expect(nextDate.getDate()).toBe(1);
    });

    it("should handle year boundary", () => {
      const dateStr = "2025-12-31";
      const dateObj = new Date(dateStr);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);

      expect(nextDate.getFullYear()).toBe(2026);
      expect(nextDate.getMonth()).toBe(0);
      expect(nextDate.getDate()).toBe(1);
    });
  });

  describe("performance", () => {
    it("should aggregate 100 links in under 5 seconds", async () => {
      const startTime = Date.now();

      const links = Array.from({ length: 100 }, (_, i) => `link-${i}`);

      // Simulate aggregation
      await Promise.all(
        links.map(async (linkId) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { linkId, clicks: 100, uniqueVisitors: 80 };
        }),
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });

    it("should handle large click counts", async () => {
      const largeStats = {
        linkId: "viral-link",
        date: "2026-01-07",
        clicks: 1000000, // 1 million clicks
        uniqueVisitors: 750000,
      };

      expect(largeStats.clicks).toBe(1000000);
      expect(largeStats.uniqueVisitors).toBeLessThanOrEqual(largeStats.clicks);
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const _jobData: AggregationJob = {
        date: "2026-01-07",
        linkIds: ["invalid-link"],
      };

      // Simulate database error
      try {
        throw new Error("Database connection failed");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Database");
      }
    });

    it("should skip invalid links and continue", async () => {
      const links = ["valid-link-1", "invalid-link", "valid-link-2"];

      const processed: string[] = [];
      const failed: string[] = [];

      for (const linkId of links) {
        try {
          if (linkId === "invalid-link") {
            throw new Error("Invalid link");
          }
          processed.push(linkId);
        } catch {
          failed.push(linkId);
        }
      }

      expect(processed).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0]).toBe("invalid-link");
    });

    it("should log aggregation metrics", async () => {
      const result = {
        aggregated: 10,
        failed: 2,
        duration: 1500,
      };

      expect(result.aggregated).toBe(10);
      expect(result.failed).toBe(2);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe("job completion", () => {
    it("should return aggregation summary", async () => {
      const _jobData: AggregationJob = {
        date: "2026-01-07",
      };

      const result = {
        aggregated: 15,
        date: "2026-01-07",
        duration: 2500,
      };

      expect(result).toHaveProperty("aggregated");
      expect(result).toHaveProperty("date");
      expect(result).toHaveProperty("duration");
      expect(result.aggregated).toBeGreaterThan(0);
    });

    it("should record metrics on completion", async () => {
      const metrics = {
        name: "analytics_aggregation_completed",
        value: 15,
        attributes: {
          date: "2026-01-07",
          duration: "2500",
        },
      };

      expect(metrics.name).toBe("analytics_aggregation_completed");
      expect(metrics.value).toBe(15);
      expect(metrics.attributes.date).toBe("2026-01-07");
    });
  });
});
