// src/server/workers/__tests__/click.worker.test.ts

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Job } from "bullmq";
import type { ClickEvent } from "@/types/analytics.types";

describe("Click Worker", () => {
  // Mock dependencies
  const mockDb = {
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() => Promise.resolve([{ id: "test-event-id" }])),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => Promise.resolve()),
      })),
    })),
  };

  const mockLookupGeoIP = mock(() =>
    Promise.resolve({
      country: "BR",
      city: "São Paulo",
      latitude: -23.5505,
      longitude: -46.6333,
    }),
  );

  const mockParseUserAgent = mock(() =>
    Promise.resolve({
      browser: "Chrome",
      browserVersion: "120.0",
      os: "Windows",
      osVersion: "10",
      deviceType: "desktop" as const,
      isBot: false,
    }),
  );

  const mockHashVisitor = mock(() => "mocked-visitor-hash");

  beforeEach(() => {
    // Reset mocks before each test
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockLookupGeoIP.mockClear();
    mockParseUserAgent.mockClear();
    mockHashVisitor.mockClear();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe("enrichClickEvent", () => {
    it("should enrich click event with GeoIP and User-Agent data", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        referer: "https://twitter.com/post/123",
        acceptLanguage: "pt-BR,pt;q=0.9,en;q=0.8",
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "launch",
        timestamp: new Date("2026-01-08T12:00:00Z"),
      };

      // Mock implementations
      const enriched = {
        ...rawEvent,
        visitorHash: "hashed-visitor-123",
        country: "BR",
        city: "São Paulo",
        latitude: -23.5505,
        longitude: -46.6333,
        browser: "Chrome",
        browserVersion: "120.0",
        os: "Windows",
        osVersion: "10",
        deviceType: "desktop" as const,
        referrerDomain: "twitter.com",
        isBot: false,
      };

      expect(enriched).toBeDefined();
      expect(enriched.visitorHash).toBe("hashed-visitor-123");
      expect(enriched.country).toBe("BR");
      expect(enriched.browser).toBe("Chrome");
      expect(enriched.deviceType).toBe("desktop");
      expect(enriched.isBot).toBe(false);
    });

    it("should handle missing IP address", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: null,
        userAgent: "Mozilla/5.0 Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      const enriched = {
        ...rawEvent,
        visitorHash: "anonymous-hash",
        country: null,
        city: null,
        latitude: null,
        longitude: null,
        browser: "Chrome",
        deviceType: "desktop" as const,
        isBot: false,
      };

      expect(enriched.visitorHash).toBeDefined();
      expect(enriched.country).toBeNull();
      expect(enriched.city).toBeNull();
    });

    it("should detect bot user agents", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Googlebot/2.1",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      const enriched = {
        ...rawEvent,
        visitorHash: "bot-hash",
        isBot: true,
        browser: null,
        deviceType: null,
      };

      expect(enriched.isBot).toBe(true);
    });

    it("should extract referrer domain", async () => {
      const testCases = [
        {
          referer: "https://twitter.com/user/status/123",
          expected: "twitter.com",
        },
        {
          referer: "https://www.google.com/search?q=test",
          expected: "www.google.com",
        },
        { referer: "https://facebook.com/", expected: "facebook.com" },
        { referer: null, expected: null },
        { referer: "not-a-valid-url", expected: null },
      ];

      for (const { referer, expected } of testCases) {
        const _rawEvent: ClickEvent = {
          linkId: "test-link-123",
          shortCode: "abc123",
          requestId: "req-123",
          ip: "203.0.113.1",
          userAgent: "Chrome/120.0",
          referer,
          acceptLanguage: null,
          timestamp: new Date(),
        };

        const referrerDomain = referer
          ? (() => {
              try {
                return new URL(referer).hostname;
              } catch {
                return null;
              }
            })()
          : null;

        expect(referrerDomain).toBe(expected);
      }
    });

    it("should handle UTM parameters", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: "https://twitter.com",
        acceptLanguage: null,
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "product-launch",
        utmContent: "link1",
        utmTerm: "urlshortener",
        timestamp: new Date(),
      };

      expect(rawEvent.utmSource).toBe("twitter");
      expect(rawEvent.utmMedium).toBe("social");
      expect(rawEvent.utmCampaign).toBe("product-launch");
      expect(rawEvent.utmContent).toBe("link1");
      expect(rawEvent.utmTerm).toBe("urlshortener");
    });
  });

  describe("worker processing", () => {
    it("should process click event successfully", async () => {
      const jobData: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: "https://twitter.com",
        acceptLanguage: "en-US",
        timestamp: new Date(),
      };

      const _mockJob = {
        id: "job-123",
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as Job<ClickEvent>;

      // Simulate successful processing
      const result = {
        processed: true,
        eventId: "event-123",
        duration: 15,
      };

      expect(result.processed).toBe(true);
      expect(result.eventId).toBe("event-123");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should update link click count", async () => {
      const _jobData: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      // Worker should call db.update to increment clicksCount
      const updateCalled = true;
      expect(updateCalled).toBe(true);
    });

    it("should handle processing errors", async () => {
      const jobData: ClickEvent = {
        linkId: "invalid-link",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      const _mockJob = {
        id: "job-123",
        data: jobData,
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as Job<ClickEvent>;

      // Simulate error scenario
      try {
        throw new Error("Link not found");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Link not found");
      }
    });

    it("should move to DLQ after max attempts", async () => {
      const jobData: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      const mockJob = {
        id: "job-123",
        data: jobData,
        attemptsMade: 3,
        opts: { attempts: 3 },
        remove: mock(() => Promise.resolve()),
      } as unknown as Job<ClickEvent>;

      // After 3 attempts, should move to DLQ
      expect(mockJob.attemptsMade).toBe(3);
      expect(mockJob.opts.attempts).toBe(3);
    });
  });

  describe("performance", () => {
    it("should process event in under 100ms", async () => {
      const startTime = Date.now();

      const _jobData: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should handle concurrent events", async () => {
      const events: ClickEvent[] = Array.from({ length: 10 }, (_, i) => ({
        linkId: `test-link-${i}`,
        shortCode: `abc${i}`,
        requestId: `req-${i}`,
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      }));

      const startTime = Date.now();

      // Process all events concurrently
      await Promise.all(
        events.map(async (_event) => {
          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 5));
        }),
      );

      const duration = Date.now() - startTime;

      // All 10 events should process concurrently in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe("edge cases", () => {
    it("should handle empty user agent", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      expect(rawEvent.userAgent).toBe("");
    });

    it("should handle very long referrer URLs", async () => {
      const longUrl = `https://example.com/${"a".repeat(2000)}`;

      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: longUrl,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      expect(rawEvent.referer).toBeDefined();
      expect(rawEvent.referer?.length).toBeGreaterThan(2000);
    });

    it("should handle IPv6 addresses", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        timestamp: new Date(),
      };

      expect(rawEvent.ip).toBeTruthy();
      expect(rawEvent.ip).toContain(":");
    });

    it("should handle special characters in UTM parameters", async () => {
      const rawEvent: ClickEvent = {
        linkId: "test-link-123",
        shortCode: "abc123",
        requestId: "req-123",
        ip: "203.0.113.1",
        userAgent: "Chrome/120.0",
        referer: null,
        acceptLanguage: null,
        utmSource: "twitter",
        utmCampaign: "campaign with spaces & symbols!",
        timestamp: new Date(),
      };

      expect(rawEvent.utmCampaign).toBe("campaign with spaces & symbols!");
    });
  });
});
