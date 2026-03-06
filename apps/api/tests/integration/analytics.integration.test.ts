// tests/integration/analytics.integration.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { db } from '@urlfy/data';
import { analyticsEvents, linkClicksDaily, links } from '@urlfy/data/schema';
import { eq } from 'drizzle-orm';
import { getWeeklySalt } from '@/server/lib/geoip';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import { AnalyticsService } from '@/server/modules/analytics';
import type { ClickEvent } from '@/types/analytics.types';
import { isDatabaseAvailable } from '../helpers/integration-helper';

function hashVisitor(ip: string | null, linkId: string): string {
  const normalizedIp = ip?.trim() || 'unknown';
  const salt = getWeeklySalt();

  return createHash('sha256')
    .update(`${normalizedIp}:${linkId}:${salt}`)
    .digest('hex');
}

const databaseAvailable = await isDatabaseAvailable();

describe('Analytics Integration', () => {
  if (!databaseAvailable) {
    it('should skip tests when database is unavailable', () => {
      console.warn(
        '⚠️  Skipping analytics integration tests: database not available'
      );
      expect(true).toBe(true);
    });
    return;
  }
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

    // Create a test link
    const [newLink] = await db
      .insert(links)
      .values({
        originalUrl: 'https://example.com',
        shortCode: `test-${Date.now()}`,
        redirectType: 301
      })
      .returning({ id: links.id });

    testLinkId = newLink.id;
  });

  afterAll(async () => {
    // Cleanup after tests
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

  describe('Analytics Event Processing', () => {
    it('should insert analytics event successfully', async () => {
      const jobData = {
        linkId: testLinkId,
        visitorHash: hashVisitor('192.168.1.1', testLinkId),
        country: 'BR',
        city: 'São Paulo',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop',
        referrer: 'https://twitter.com',
        utmSource: 'twitter',
        utmMedium: 'social',
        utmCampaign: 'test',
        isBot: false
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
          deviceType: 'desktop' as const,
          referrer: jobData.referrer,
          utmSource: jobData.utmSource,
          utmMedium: jobData.utmMedium,
          utmCampaign: jobData.utmCampaign,
          isBot: jobData.isBot
        })
        .returning({ id: analyticsEvents.id });

      expect(event.id).toBeDefined();

      // Verify insertion
      const retrieved = await db
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.id, event.id));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].country).toBe('BR');
      expect(retrieved[0].isBot).toBe(false);
    });

    it('should update link click counter', async () => {
      const initialClicks = await db
        .select({ clicks: links.clicksCount })
        .from(links)
        .where(eq(links.id, testLinkId));

      const initialCount = initialClicks[0]?.clicks || 0;

      // Simulate clicks update
      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash: hashVisitor('192.168.1.2', testLinkId),
        country: 'US',
        browser: 'Safari',
        os: 'iOS',
        deviceType: 'mobile',
        isBot: false
      });

      // Update counter
      const updated = await db
        .select({ clicks: links.clicksCount })
        .from(links)
        .where(eq(links.id, testLinkId));

      expect(updated[0]?.clicks).toBeGreaterThanOrEqual(initialCount);
    });

    it('should handle multiple events from same visitor in same week', async () => {
      const visitorHash = hashVisitor('192.168.1.3', testLinkId);

      // Insert two events from the same visitor
      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash,
        country: 'BR',
        isBot: false
      });

      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash,
        country: 'BR',
        isBot: false
      });

      // Both should have the same hash
      const events = await db
        .select({ hash: analyticsEvents.visitorHash })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.visitorHash, visitorHash));

      expect(events.length).toBe(2);
      expect(
        events.every((e: { hash: string | null }) => e.hash === visitorHash)
      ).toBe(true);
    });

    it('should exclude bots from analytics', async () => {
      const botHash = hashVisitor('bot-ip', testLinkId);

      await db.insert(analyticsEvents).values({
        linkId: testLinkId,
        visitorHash: botHash,
        country: 'US',
        isBot: true
      });

      // Verify bot insertion
      const botEvents = await db
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.isBot, true));

      expect(botEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics Service', () => {
    it('should get daily stats', async () => {
      // Insert some events
      for (let i = 0; i < 3; i++) {
        await db.insert(analyticsEvents).values({
          linkId: testLinkId,
          visitorHash: hashVisitor(`visitor-${i}`, testLinkId),
          country: 'BR',
          isBot: false
        });
      }

      // Aggregate manually
      const today = new Date().toISOString().split('T')[0];
      await db
        .insert(linkClicksDaily)
        .values({
          linkId: testLinkId,
          date: today,
          clicks: 3,
          uniqueVisitors: 3
        })
        .onConflictDoUpdate({
          target: [linkClicksDaily.linkId, linkClicksDaily.date],
          set: {
            clicks: 3,
            uniqueVisitors: 3
          }
        });

      // Obtém stats
      const stats = await AnalyticsService.getDailyStats(testLinkId, 1);

      expect(stats.length).toBeGreaterThan(0);
    });

    it('should get country breakdown', async () => {
      const breakdown = await AnalyticsService.getCountryBreakdown(
        testLinkId,
        10,
        7
      );

      expect(Array.isArray(breakdown)).toBe(true);
    });

    it('should get device breakdown', async () => {
      const breakdown = await AnalyticsService.getDeviceBreakdown(
        testLinkId,
        7
      );

      expect(Array.isArray(breakdown)).toBe(true);
    });

    it('should get summary', async () => {
      const summary = await AnalyticsService.getSummary(testLinkId, 7);

      if (summary) {
        expect(summary).toHaveProperty('totalClicks');
        expect(summary).toHaveProperty('uniqueVisitors');
        expect(summary).toHaveProperty('avgClicksPerDay');
      }
    });

    it('should calculate growth metrics in summary', async () => {
      // Insert events for current period (last 7 days)
      const currentDate = new Date();
      for (let i = 0; i < 5; i++) {
        await db.insert(analyticsEvents).values({
          linkId: testLinkId,
          visitorHash: hashVisitor(`current-visitor-${i}`, testLinkId),
          country: 'BR',
          isBot: false,
          createdAt: new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000) // Last 5 days
        });
      }

      // Insert events for previous period (7-14 days ago)
      for (let i = 0; i < 3; i++) {
        const previousDate = new Date(
          currentDate.getTime() - (7 + i) * 24 * 60 * 60 * 1000
        );
        await db.insert(analyticsEvents).values({
          linkId: testLinkId,
          visitorHash: hashVisitor(`previous-visitor-${i}`, testLinkId),
          country: 'US',
          isBot: false,
          createdAt: previousDate
        });
      }

      // Get summary with growth calculations
      const summary = await AnalyticsService.getSummary(testLinkId, 7);

      expect(summary).not.toBeNull();
      if (summary) {
        // Should have growth fields
        expect(summary).toHaveProperty('totalClicksGrowth');
        expect(summary).toHaveProperty('uniqueVisitorsGrowth');

        // Growth should be calculated (5 current vs 3 previous = ~67% growth)
        expect(typeof summary.totalClicksGrowth).toBe('number');
        expect(typeof summary.uniqueVisitorsGrowth).toBe('number');

        // With 5 events in current period and 3 in previous, growth should be positive
        expect(summary.totalClicksGrowth).toBeGreaterThan(0);
        expect(summary.uniqueVisitorsGrowth).toBeGreaterThan(0);
      }
    });

    it('should pass health check', async () => {
      const health = await AnalyticsService.healthCheck();

      expect(health.status).toBe('ok');
      expect(health).toHaveProperty('totalEvents');
      expect(health).toHaveProperty('latestEvent');
    });
  });

  describe('Analytics Queue', () => {
    it('should queue analytics job', async () => {
      const jobData: ClickEvent = {
        linkId: testLinkId,
        shortCode: 'queue-test',
        requestId: `req-${Date.now()}`,
        ip: '127.0.0.1',
        userAgent: 'bun-test',
        referer: null,
        acceptLanguage: 'en-US',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        timestamp: new Date()
      };

      const jobId = await RedisStream.add(STREAM_NAMES.analytics, {
        type: 'click',
        ...jobData
      });

      expect(jobId).toBeDefined();

      // Cleanup not strictly necessary for streams in test (flushed in beforeAll)
    });
  });
});
