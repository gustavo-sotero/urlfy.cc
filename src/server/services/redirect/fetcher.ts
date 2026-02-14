import { trace } from '@opentelemetry/api';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { CircuitBreaker } from '@/server/lib/circuit-breaker';
import { acquireLock, releaseLock } from '@/server/lib/redis';
import {
  createLogger,
  recordCacheHit,
  recordCacheMiss,
  redisFallbacks,
  stampedeLocksAcquired,
  stampedeLocksWaited
} from '@/server/lib/telemetry';
import type { CachedLink } from '@/types/redirect.types';
import { CACHE_PREFIX, cacheService } from '../cache.service';

const { links } = schema;

const logger = createLogger('redirect-fetcher');
const tracer = trace.getTracer('redirect-fetcher');

// Lock TTL for stampede protection (5 seconds)
const LOCK_TTL = 5000;

// Circuit breaker for PostgreSQL
const dbCircuitBreaker = new CircuitBreaker({
  name: 'postgres-redirect',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 10000
});

export interface LinkFetchResult {
  link: CachedLink | null;
  cacheHit: boolean;
}

/**
 * Fetch link using a Cache-Aside strategy
 * Includes Cache Stampede protection
 */
export async function getLink(code: string): Promise<LinkFetchResult> {
  return tracer.startActiveSpan(
    'redirect.getLink',
    { attributes: { code } },
    async (span) => {
      try {
        let cacheHit = false;
        // L1: Negative cache check (404)
        const is404 = await cacheService.isNotFound(code);
        if (is404) {
          logger.debug('Negative cache hit', { code });
          span.setAttribute('cache.type', 'negative');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'negative' });
          cacheHit = true;
          return { link: null, cacheHit };
        }

        // L2: Check banned link cache
        const isBanned = await cacheService.isBanned(code);
        if (isBanned) {
          logger.debug('Banned cache hit', { code });
          span.setAttribute('cache.type', 'banned');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'banned' });
          // Return a "phantom" link so validateLink returns BANNED
          cacheHit = true;
          return {
            link: {
              id: 'banned',
              originalUrl: '',
              redirectType: 302 as const,
              isActive: true,
              isBanned: true,
              expiresAt: null,
              maxClicks: null,
              clicksCount: 0,
              passwordHash: null,
              utmSource: null,
              utmMedium: null,
              utmCampaign: null
            },
            cacheHit
          };
        }

        // L3: Normal link cache
        const cached = await cacheService.getLink(code);
        if (cached) {
          logger.debug('Link cache hit', { code });
          span.setAttribute('cache.type', 'link');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'link' });
          cacheHit = true;
          return { link: cached, cacheHit };
        }

        // L4: Cache miss - fetch from DB with stampede protection
        logger.debug('Cache miss', { code });
        span.setAttribute('cache.hit', false);
        recordCacheMiss(1);
        return {
          link: await fetchWithStampedeProtection(code),
          cacheHit
        };
      } catch (error) {
        // Fallback: direct DB fetch on Redis error
        logger.warn('Redis error, falling back to database', {
          code,
          error: error instanceof Error ? error.message : String(error)
        });
        span.recordException(error as Error);
        span.setAttribute('fallback', true);
        redisFallbacks.add(1);
        return { link: await fetchFromDatabase(code), cacheHit: false };
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Cache Stampede protection using Distributed Lock
 *
 * When multiple requests arrive simultaneously for an uncached link,
 * only one fetches from the database while the others wait.
 */
async function fetchWithStampedeProtection(
  code: string
): Promise<CachedLink | null> {
  const lockKey = `${CACHE_PREFIX.LOCK}${code}`;

  // Tries to acquire the lock
  const acquired = await acquireLock(lockKey, { ttl: LOCK_TTL });

  if (acquired) {
    // This request won the lock - fetch from database
    stampedeLocksAcquired.add(1);
    try {
      logger.debug('Lock acquired, fetching from database', { code });

      const link = await fetchFromDatabase(code);

      if (link) {
        // Populate cache
        await cacheService.setLink(code, link);
      } else {
        // Negative cache
        await cacheService.setNotFound(code);
      }

      return link;
    } finally {
      // Always release the lock
      await releaseLock(lockKey);
    }
  }

  // Another request is populating the cache - wait with jitter
  stampedeLocksWaited.add(1);
  logger.debug('Lock not acquired, waiting for cache population', { code });
  // Jittered backoff: 50-100ms to desynchronize retries
  const jitter = 50 + Math.floor(Math.random() * 50);
  await Bun.sleep(jitter);

  // Try to get from cache again (probably already populated)
  const cached = await cacheService.getLink(code);
  if (cached) {
    return cached;
  }

  // If still not in cache, fallback to direct fetch
  logger.warn('Cache still empty after waiting, fetching from database', {
    code
  });
  return fetchFromDatabase(code);
}

/**
 * Fetch from PostgreSQL with Circuit Breaker
 */
async function fetchFromDatabase(code: string): Promise<CachedLink | null> {
  return dbCircuitBreaker.execute(async () => {
    // Use direct select with where instead of query builder due to type issues
    const results = await db
      .select({
        id: links.id,
        originalUrl: links.originalUrl,
        redirectType: links.redirectType,
        isActive: links.isActive,
        isBanned: links.isBanned,
        expiresAt: links.expiresAt,
        maxClicks: links.maxClicks,
        clicksCount: links.clicksCount,
        passwordHash: links.passwordHash,
        utmSource: links.utmSource,
        utmMedium: links.utmMedium,
        utmCampaign: links.utmCampaign
      })
      .from(links)
      .where(eq(links.shortCode, code))
      .limit(1);

    const link = results[0];

    if (!link) {
      logger.debug('Link not found in database', { code });
      return null;
    }

    // Convert to CachedLink (timestamp to string)
    return {
      id: link.id,
      originalUrl: link.originalUrl,
      redirectType: link.redirectType as 301 | 302,
      isActive: link.isActive,
      isBanned: link.isBanned,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      maxClicks: link.maxClicks,
      clicksCount: link.clicksCount,
      passwordHash: link.passwordHash,
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign
    } as CachedLink;
  });
}

/**
 * Check if a short link code is available
 * (used when creating custom links)
 */
export async function isCodeAvailable(code: string): Promise<boolean> {
  try {
    // Check cache first
    const cached = await cacheService.getLink(code);
    if (cached) {
      return false;
    }

    // Check database using direct select
    const results = await db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.shortCode, code))
      .limit(1);

    return results.length === 0;
  } catch (error) {
    logger.error('Error checking code availability', {
      code,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Health check helper
 */
export function getCircuitBreakerStatus(): string {
  return dbCircuitBreaker.getStatus();
}
