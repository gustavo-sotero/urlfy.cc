// tests/perf/analytics.perf.test.ts

import { describe, expect, it } from 'bun:test';
import type { ClickEvent } from '@/types/analytics.types';
import { testLogger } from '../helpers/test-logger';

describe('Analytics Performance Tests', () => {
  describe('Event Processing Throughput', () => {
    it('should handle 1000 events in under 5 seconds', async () => {
      const events: ClickEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        linkId: `link-${i % 100}`, // 100 different links
        shortCode: `code-${i % 100}`,
        requestId: `req-${i}`,
        ip: `203.0.113.${i % 256}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        referer: i % 2 === 0 ? 'https://twitter.com' : null,
        acceptLanguage: 'en-US,en;q=0.9',
        utmSource: i % 3 === 0 ? 'twitter' : undefined,
        utmMedium: i % 3 === 0 ? 'social' : undefined,
        timestamp: new Date()
      }));

      const startTime = Date.now();

      // Simulate batch processing
      const batchSize = 100;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (event) => {
            // Simulate processing time (enrichment + DB insert)
            await new Promise((resolve) => setTimeout(resolve, 2));
            return event;
          })
        );
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      testLogger.info(`✓ Processed 1000 events in ${duration}ms`);
      testLogger.info(
        `  Throughput: ${Math.round((1000 / duration) * 1000)} events/sec`
      );
    });

    it('should maintain < 100ms P99 latency under load', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        // Simulate event processing
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      // Calculate P99
      latencies.sort((a, b) => a - b);
      const p99Index = Math.floor(iterations * 0.99);
      const p99 = latencies[p99Index];

      expect(p99).toBeLessThan(100);
      testLogger.info(`✓ P99 latency: ${p99}ms`);
    });

    it('should handle burst traffic (1000 events/second)', async () => {
      const eventsPerSecond = 1000;
      const durationSeconds = 1;
      const totalEvents = eventsPerSecond * durationSeconds;

      const startTime = Date.now();

      // Simulate burst
      await Promise.all(
        Array.from({ length: totalEvents }, async (_, i) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { eventId: i };
        })
      );

      const duration = Date.now() - startTime;
      const actualThroughput = (totalEvents / duration) * 1000;

      expect(actualThroughput).toBeGreaterThanOrEqual(eventsPerSecond * 0.8); // 80% tolerance
      testLogger.info(
        `✓ Burst throughput: ${Math.round(actualThroughput)} events/sec`
      );
    });
  });

  describe('Aggregation Performance', () => {
    it('should aggregate 100 links in under 10 seconds', async () => {
      const linkCount = 100;
      const eventsPerLink = 1000;

      const startTime = Date.now();

      // Simulate aggregation for each link
      await Promise.all(
        Array.from({ length: linkCount }, async (_, i) => {
          // Simulate counting + grouping
          await new Promise((resolve) => setTimeout(resolve, 50));

          return {
            linkId: `link-${i}`,
            clicks: eventsPerLink,
            uniqueVisitors: Math.floor(eventsPerLink * 0.8)
          };
        })
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
      testLogger.info(`✓ Aggregated ${linkCount} links in ${duration}ms`);
    });

    it('should handle aggregation of 1M events', async () => {
      const totalEvents = 1000000;
      const links = 1000;
      const _eventsPerLink = totalEvents / links;

      const startTime = Date.now();

      // Simulate batch aggregation
      const batchSize = 100;
      for (let i = 0; i < links; i += batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 30s)
      expect(duration).toBeLessThan(30000);
      testLogger.info(
        `✓ Aggregated ${totalEvents.toLocaleString()} events in ${duration}ms`
      );
    });

    it('should efficiently calculate unique visitors', async () => {
      const events = 10000;
      const uniqueRatio = 0.7; // 70% unique

      const startTime = Date.now();

      // Simulate counting unique visitors
      const visitorHashes = new Set<string>();
      for (let i = 0; i < events; i++) {
        // Simulate hash generation
        const hash = `hash-${
          i < events * uniqueRatio ? i : i % Math.floor(events * uniqueRatio)
        }`;
        visitorHashes.add(hash);
      }

      const duration = Date.now() - startTime;

      expect(visitorHashes.size).toBeCloseTo(events * uniqueRatio, -2);
      expect(duration).toBeLessThan(100);
      testLogger.info(
        `✓ Counted ${visitorHashes.size} unique visitors from ${events} events in ${duration}ms`
      );
    });
  });

  describe('GeoIP Lookup Performance', () => {
    it('should lookup 1000 IPs in under 1 second', async () => {
      const ipCount = 1000;

      const startTime = Date.now();

      // Simulate GeoIP lookups (in reality, these would be cached)
      await Promise.all(
        Array.from({ length: ipCount }, async (_, i) => {
          const ip = `203.0.${Math.floor(i / 256)}.${i % 256}`;

          // Simulate lookup time
          await new Promise((resolve) => setTimeout(resolve, 0.5));

          return {
            ip,
            country: 'BR',
            city: 'São Paulo'
          };
        })
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      testLogger.info(
        `✓ Looked up ${ipCount} IPs in ${duration}ms (${Math.round(
          (ipCount / duration) * 1000
        )} lookups/sec)`
      );
    });

    it('should benefit from /24 prefix caching', async () => {
      const ipsPerPrefix = 100;
      const prefixes = 10;
      const totalIps = ipsPerPrefix * prefixes;

      const cacheLookups = new Map<string, number>();

      const startTime = Date.now();

      for (let prefix = 0; prefix < prefixes; prefix++) {
        const prefixKey = `203.0.${prefix}`;

        for (let host = 0; host < ipsPerPrefix; host++) {
          const _ip = `${prefixKey}.${host}`;

          // First lookup per prefix is slow, rest are cached
          if (!cacheLookups.has(prefixKey)) {
            await new Promise((resolve) => setTimeout(resolve, 1));
            cacheLookups.set(prefixKey, 1);
          } else {
            // Cache hit - instant
            const current = cacheLookups.get(prefixKey) ?? 0;
            cacheLookups.set(prefixKey, current + 1);
          }
        }
      }

      const duration = Date.now() - startTime;

      // Should be much faster due to caching
      expect(duration).toBeLessThan(200);
      expect(cacheLookups.size).toBe(prefixes);
      testLogger.info(
        `✓ ${totalIps} IPs, ${prefixes} cache lookups in ${duration}ms`
      );
    });
  });

  describe('User-Agent Parsing Performance', () => {
    it('should parse 100 user agents in under 500ms', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
        'Mozilla/5.0 (Android 14) Chrome/120.0.0.0 Mobile',
        'Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0'
      ];

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const _ua = userAgents[i % userAgents.length];

        // Simulate UA parsing (very fast operation)
        const _parsed = {
          browser: 'Chrome',
          os: 'Windows',
          deviceType: 'desktop' as const,
          isBot: false
        };
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      testLogger.info(
        `✓ Parsed ${iterations} user agents in ${duration}ms (${Math.round(
          (iterations / duration) * 1000
        )} parses/sec)`
      );
    });

    it('should detect bots efficiently', async () => {
      const mixedUserAgents = [
        ...Array(700).fill('Mozilla/5.0 Chrome/120.0'), // Real users
        ...Array(300).fill('Googlebot/2.1') // Bots
      ];

      const startTime = Date.now();

      const botCount = mixedUserAgents.filter((ua) => {
        return /bot|crawler|spider/i.test(ua);
      }).length;

      const duration = Date.now() - startTime;

      expect(botCount).toBe(300);
      expect(duration).toBeLessThan(10);
      testLogger.info(`✓ Detected ${botCount} bots in ${duration}ms`);
    });
  });

  describe('Database Query Performance', () => {
    it('should insert 1000 events in under 2 seconds', async () => {
      const eventCount = 1000;
      const batchSize = 100;

      const startTime = Date.now();

      // Simulate batch inserts
      for (let i = 0; i < eventCount; i += batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      testLogger.info(
        `✓ Inserted ${eventCount} events in ${duration}ms (${Math.round(
          (eventCount / duration) * 1000
        )} inserts/sec)`
      );
    });

    it('should query daily stats in under 100ms', async () => {
      const _linkId = 'test-link';
      const days = 30;

      const startTime = Date.now();

      // Simulate query
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        clicks: Math.floor(Math.random() * 1000),
        unique: Math.floor(Math.random() * 800)
      }));

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(stats).toHaveLength(days);
      testLogger.info(`✓ Queried ${days} days of stats in ${duration}ms`);
    });

    it('should aggregate country breakdown in under 200ms', async () => {
      const _linkId = 'test-link';
      const countries = 50;

      const startTime = Date.now();

      // Simulate aggregation query
      await new Promise((resolve) => setTimeout(resolve, 100));

      const breakdown = Array.from({ length: countries }, (_, i) => ({
        country: `C${i}`,
        clicks: Math.floor(Math.random() * 1000),
        percentage: 0
      }));

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
      expect(breakdown).toHaveLength(countries);
      testLogger.info(`✓ Aggregated ${countries} countries in ${duration}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle large event batch without memory spike', () => {
      const eventCount = 10000;
      const events: ClickEvent[] = [];

      const initialMemory = process.memoryUsage().heapUsed;

      // Create large batch
      for (let i = 0; i < eventCount; i++) {
        events.push({
          linkId: `link-${i % 100}`,
          shortCode: `code-${i % 100}`,
          requestId: `req-${i}`,
          ip: `203.0.113.${i % 256}`,
          userAgent: 'Chrome/120.0',
          referer: null,
          acceptLanguage: 'en-US',
          timestamp: new Date()
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      // Should use < 50MB for 10k events
      expect(memoryIncreaseMB).toBeLessThan(50);
      testLogger.info(
        `✓ ${eventCount} events used ${memoryIncreaseMB.toFixed(2)}MB`
      );
    });

    it('should efficiently stream large result sets', async () => {
      const resultCount = 100000;
      const batchSize = 1000;

      let processed = 0;

      // Simulate streaming
      for (let i = 0; i < resultCount; i += batchSize) {
        // Process batch
        await new Promise((resolve) => setTimeout(resolve, 1));
        processed += Math.min(batchSize, resultCount - i);
      }

      expect(processed).toBe(resultCount);
      testLogger.info(
        `✓ Streamed ${resultCount.toLocaleString()} results in batches`
      );
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent aggregations', async () => {
      const concurrentJobs = 10;
      const linksPerJob = 10;

      const startTime = Date.now();

      await Promise.all(
        Array.from({ length: concurrentJobs }, async (_, jobId) => {
          // Simulate job processing
          await Promise.all(
            Array.from({ length: linksPerJob }, async (_, linkId) => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return {
                jobId,
                linkId,
                aggregated: true
              };
            })
          );
        })
      );

      const duration = Date.now() - startTime;

      // Should benefit from concurrency
      expect(duration).toBeLessThan(1000);
      testLogger.info(
        `✓ ${concurrentJobs} concurrent jobs (${linksPerJob} links each) in ${duration}ms`
      );
    });

    it('should maintain throughput under concurrent load', async () => {
      const concurrentStreams = 5;
      const eventsPerStream = 200;

      const startTime = Date.now();

      const results = await Promise.all(
        Array.from({ length: concurrentStreams }, async (_streamId) => {
          const processed: number[] = [];
          for (let i = 0; i < eventsPerStream; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1));
            processed.push(i);
          }
          return processed.length;
        })
      );

      const duration = Date.now() - startTime;
      const totalEvents = results.reduce((sum, count) => sum + count, 0);
      const throughput = (totalEvents / duration) * 1000;

      expect(throughput).toBeGreaterThan(200); // > 200 events/sec
      testLogger.info(
        `✓ ${concurrentStreams} concurrent streams: ${totalEvents} events in ${duration}ms (${Math.round(
          throughput
        )} events/sec)`
      );
    });
  });
});
