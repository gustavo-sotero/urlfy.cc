import { trace } from '@opentelemetry/api';
import {
  acquireLock,
  CACHE_KEYS,
  CACHE_TTL as CANONICAL_CACHE_TTL,
  getPendingClicks,
  releaseLock
} from '@urlfy/cache';
import { CircuitBreaker } from '@urlfy/cache/circuit-breaker';
import type { CachedLink } from '@urlfy/contracts/redirect';
import {
  createLogger,
  recordCacheHit,
  recordCacheMiss,
  redisFallbacks,
  stampedeLocksAcquired,
  stampedeLocksWaited
} from '@urlfy/telemetry';
import { cacheService } from './cache-service';
import type { LinkFetchResult, RedirectFetcherDependencies } from './types';

const logger = createLogger('redirect-fetcher');
const tracer = trace.getTracer('redirect-fetcher');

// Lock TTL for stampede protection — derived from canonical CACHE_TTL.LOCK (seconds) converted to ms
const LOCK_TTL_MS = CANONICAL_CACHE_TTL.LOCK * 1000;

// Circuit breaker for PostgreSQL
const dbCircuitBreaker = new CircuitBreaker({
  name: 'postgres-redirect',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 10000
});

async function applyPendingClicks(
  link: CachedLink | null
): Promise<CachedLink | null> {
  if (!link) {
    return null;
  }

  const pendingClicks = await getPendingClicks(link.id);

  if (pendingClicks <= 0) {
    return link;
  }

  return {
    ...link,
    clicksCount: link.clicksCount + pendingClicks
  };
}

async function applyPendingClicksForEnforcement(
  link: CachedLink | null
): Promise<CachedLink | null> {
  if (!link || link.maxClicks == null) {
    return link;
  }

  return applyPendingClicks(link);
}

export const defaultRedirectFetcherDependencies: RedirectFetcherDependencies = {
  cache: cacheService,
  links: {
    findByCode: (_code: string) => {
      throw new Error(
        '[redirect-domain] No links repository configured. ' +
          'Wire a concrete RedirectLinkRepository from the data package ' +
          'before calling redirectService.'
      );
    },
    isCodeAvailable: (_code: string) => {
      throw new Error(
        '[redirect-domain] No links repository configured. ' +
          'Wire a concrete RedirectLinkRepository from the data package ' +
          'before calling redirectService.'
      );
    }
  },
  lock: {
    acquire: (key, ttlMs) => acquireLock(key, ttlMs),
    release: (key) => releaseLock(key)
  },
  circuitBreaker: dbCircuitBreaker,
  random: () => Math.random(),
  sleep: (delayMs) => Bun.sleep(delayMs)
};

/**
 * Fetch link using a Cache-Aside strategy
 * Includes Cache Stampede protection
 */
export async function getLink(
  code: string,
  dependencies: RedirectFetcherDependencies = defaultRedirectFetcherDependencies
): Promise<LinkFetchResult> {
  return tracer.startActiveSpan(
    'redirect.getLink',
    { attributes: { code } },
    async (span) => {
      try {
        const cacheHit = false;

        // Parallel cache lookup: 404 + banned + link in 1 RTT
        const state = await dependencies.cache.getLinkState(code, {
          random: dependencies.random
        });

        // L1: Negative cache check (404)
        if (state.isNotFound) {
          logger.debug('Negative cache hit', { code });
          span.setAttribute('cache.type', 'negative');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'negative' });
          return { link: null, cacheHit: true };
        }

        // L2: Check banned link cache
        if (state.isBanned) {
          logger.debug('Banned cache hit', { code });
          span.setAttribute('cache.type', 'banned');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'banned' });
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
            cacheHit: true
          };
        }

        // L3: Normal link cache. Early-refresh decisions are owned by the cache adapter.
        if (state.link) {
          const parsed = state.link;
          logger.debug('Link cache hit', { code });
          span.setAttribute('cache.type', 'link');
          span.setAttribute('cache.hit', true);
          recordCacheHit(1, { type: 'link' });
          const link = await applyPendingClicksForEnforcement(parsed);
          return { link, cacheHit: true };
        }

        // L4: Cache miss - fetch from DB with stampede protection
        logger.debug('Cache miss', { code });
        span.setAttribute('cache.hit', false);
        recordCacheMiss(1);
        return {
          link: await fetchWithStampedeProtection(code, dependencies),
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
        return {
          link: await fetchFromDatabase(code, dependencies),
          cacheHit: false
        };
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
  code: string,
  dependencies: RedirectFetcherDependencies
): Promise<CachedLink | null> {
  // Use canonical key builder: 'lock:{code}' — avoids double-prefix from local CACHE_PREFIX.LOCK
  const lockKey = CACHE_KEYS.LOCK(code);

  // Tries to acquire the lock (ttlMs: explicit milliseconds)
  const acquired = await dependencies.lock.acquire(lockKey, LOCK_TTL_MS);

  if (acquired) {
    // This request won the lock - fetch from database
    stampedeLocksAcquired.add(1);
    try {
      logger.debug('Lock acquired, fetching from database', { code });

      const link = await fetchFromDatabase(code, dependencies);

      if (link) {
        // Populate cache
        await dependencies.cache.setLink(code, link);
      } else {
        // Negative cache
        await dependencies.cache.setNotFound(code);
      }

      return link;
    } finally {
      // Always release the lock
      await dependencies.lock.release(lockKey);
    }
  }

  // Another request is populating the cache - wait with jitter
  stampedeLocksWaited.add(1);
  logger.debug('Lock not acquired, waiting for cache population', { code });
  // Jittered backoff: 50-100ms to desynchronize retries
  const jitter =
    50 + Math.floor((dependencies.random?.() ?? Math.random()) * 50);
  await (dependencies.sleep?.(jitter) ?? Bun.sleep(jitter));

  // Try to get from cache again (probably already populated)
  const cached = await dependencies.cache.getLink(code);
  if (cached) {
    return applyPendingClicksForEnforcement(cached);
  }

  // If still not in cache, fallback to direct fetch
  logger.warn('Cache still empty after waiting, fetching from database', {
    code
  });
  return fetchFromDatabase(code, dependencies);
}

/**
 * Fetch from PostgreSQL with Circuit Breaker
 */
async function fetchFromDatabase(
  code: string,
  dependencies: RedirectFetcherDependencies = defaultRedirectFetcherDependencies
): Promise<CachedLink | null> {
  return dependencies.circuitBreaker.execute(async () =>
    applyPendingClicksForEnforcement(await dependencies.links.findByCode(code))
  );
}

/**
 * Check if a short link code is available
 * (used when creating custom links)
 */
export async function isCodeAvailable(
  code: string,
  dependencies: RedirectFetcherDependencies = defaultRedirectFetcherDependencies
): Promise<boolean> {
  try {
    // Check cache first
    const cached = await dependencies.cache.getLink(code);
    if (cached) {
      return false;
    }

    return dependencies.links.isCodeAvailable(code);
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
export function getCircuitBreakerStatus(
  dependencies: RedirectFetcherDependencies = defaultRedirectFetcherDependencies
): string {
  return dependencies.circuitBreaker.getStatus();
}
