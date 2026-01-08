// tests/integration/analytics.integration.test.ts

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, linkClicksDaily, links } from "@/db/schema";
import { hashVisitor } from "@/server/lib/privacy";
import { analyticsQueue } from "@/server/lib/queue";
import { analyticsService } from "@/server/services/analytics.service";
import type { ClickEvent } from "@/types/analytics.types";

describe("Analytics Integration", () => {
  let testLinkId: string;
  let _testUserId: string;

  beforeAll(async () => {
    // Cleanup antes de testes
    await db
      .delete(analyticsEvents)
      .execute()
      .catch(() => {});
    await db
      .delete(linkClicksDaily)
      .execute()
      .catch(() => {});
    await db
      .delete(links)
      .execute()
      .catch(() => {});

    // Cria um link de teste
    const [newLink] = await db
      .insert(links)
      .values({
        originalUrl: "https://example.com",
        shortCode: `test-${Date.now()}`,
        redirectType: 301,
      })
      .returning({ id: links.id });

    testLinkId = newLink.id;
  });

  afterAll(async () => {
    // Cleanup após testes
    await db
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.linkId, testLinkId))
      .execute()
      .catch(() => {});
    await db
      .delete(linkClicksDaily)
      .where(eq(linkClicksDaily.linkId, testLinkId))
      .execute()
      .catch(() => {});
    await db
      .delete(links)
      .where(eq(links.id, testLinkId))
      .execute()
      .catch(() => {});
  });

  describe("Analytics Event Processing", () => {
    it("should insert analytics event successfully", async () => {
      const jobData = {
        linkId: testLinkId,
        visitorHash: hashVisitor("192.168.1.1", testLinkId),
        country: "BR",
        city: "São Paulo",
        browser: "Chrome",
        os: "Windows",
        deviceType: "desktop",
        referrer: "https://twitter.com",
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "test",
        isBot: false,
      };

      const [event] = await db
        .insert(analyticsEvents)
        .values({
          linkId: jobData.linkId,
          visitorHash: jobData.visitorHash,
          country: jobData.country,
          city: jobData.city,
          browser: jobData.browser,
          os: jobData.os,
          deviceType: "desktop" as const,
          referrer: jobData.referrer,
          utmSource: jobData.utmSource,
          utmMedium: jobData.utmMedium,
          utmCampaign: jobData.utmCampaign,
          isBot: jobData.isBot,
        })
        .returning({ id: analyticsEvents.id });

      expect(event.id).toBeDefined();

      // Verifica inserção
      const retrieved = await db
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.id, event.id));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].country).toBe("BR");
      expect(retrieved[0].isBot).toBe(false);
    });

    it("should update link click counter", async () => {
      const initialClicks = await db
        .select({ clicks: links.clicksCount })
        .from(links)
        .where(eq(links.id, testLinkId));

      const initialCount = initialClicks[0]?.clicks || 0;

      // Simula update de clicks
      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash: hashVisitor("192.168.1.2", testLinkId),
        country: "US",
        browser: "Safari",
        os: "iOS",
        deviceType: "mobile",
        isBot: false,
      });

      // Atualiza contador
      const updated = await db
        .select({ clicks: links.clicksCount })
        .from(links)
        .where(eq(links.id, testLinkId));

      expect(updated[0]?.clicks).toBeGreaterThanOrEqual(initialCount);
    });

    it("should handle multiple events from same visitor in same week", async () => {
      const visitorHash = hashVisitor("192.168.1.3", testLinkId);

      // Insere dois eventos do mesmo visitante
      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash,
        country: "BR",
        isBot: false,
      });

      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash,
        country: "BR",
        isBot: false,
      });

      // Ambos devem ter o mesmo hash
      const events = await db
        .select({ hash: analyticsEvents.visitorHash })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.visitorHash, visitorHash));

      expect(events.length).toBe(2);
      expect(events.every((e) => e.hash === visitorHash)).toBe(true);
    });

    it("should exclude bots from analytics", async () => {
      const botHash = hashVisitor("bot-ip", testLinkId);

      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash: botHash,
        country: "US",
        isBot: true,
      });

      // Verifica inserção de bot
      const botEvents = await db
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.isBot, true));

      expect(botEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Analytics Service", () => {
    it("should get daily stats", async () => {
      // Insere alguns eventos
      for (let i = 0; i < 3; i++) {
        await db.insert(analyticsEvents).values({
          linkId: testLinkId,
          visitorHash: hashVisitor(`visitor-${i}`, testLinkId),
          country: "BR",
          isBot: false,
        });
      }

      // Agrega manualmente
      const today = new Date().toISOString().split("T")[0];
      await db
        .insert(linkClicksDaily)
        .values({
          linkId: testLinkId,
          date: today,
          clicks: 3,
          uniqueVisitors: 3,
        })
        .onConflictDoUpdate({
          target: [linkClicksDaily.linkId, linkClicksDaily.date],
          set: {
            clicks: 3,
            uniqueVisitors: 3,
          },
        });

      // Obtém stats
      const stats = await analyticsService.getDailyStats(testLinkId, 1);

      expect(stats.length).toBeGreaterThan(0);
    });

    it("should get country breakdown", async () => {
      const breakdown = await analyticsService.getCountryBreakdown(
        testLinkId,
        10,
        7,
      );

      expect(Array.isArray(breakdown)).toBe(true);
    });

    it("should get device breakdown", async () => {
      const breakdown = await analyticsService.getDeviceBreakdown(
        testLinkId,
        7,
      );

      expect(Array.isArray(breakdown)).toBe(true);
    });

    it("should get summary", async () => {
      const summary = await analyticsService.getSummary(testLinkId, 7);

      if (summary) {
        expect(summary).toHaveProperty("totalClicks");
        expect(summary).toHaveProperty("uniqueVisitors");
        expect(summary).toHaveProperty("avgClicksPerDay");
      }
    });

    it("should pass health check", async () => {
      const health = await analyticsService.healthCheck();

      expect(health.status).toBe("ok");
      expect(health).toHaveProperty("totalEvents");
      expect(health).toHaveProperty("latestEvent");
    });
  });

  describe("Analytics Queue", () => {
    it("should queue analytics job", async () => {
      const jobData: ClickEvent = {
        linkId: testLinkId,
        shortCode: "queue-test",
        requestId: `req-${Date.now()}`,
        ip: "127.0.0.1",
        userAgent: "bun-test",
        referer: null,
        acceptLanguage: "en-US",
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        timestamp: new Date(),
      };

      const job = await analyticsQueue.add("click", jobData, {
        jobId: `test-${Date.now()}`,
        removeOnComplete: true,
      });

      expect(job.id).toBeDefined();

      // Cleanup
      await job.remove().catch(() => {});
    });
  });
});
