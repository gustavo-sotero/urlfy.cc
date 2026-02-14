// src/server/services/cache.service.ts

import { getRedisClient } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { CachedLink } from '@/types/redirect.types';

const logger = createLogger('cache-service');

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  LINK: 3600, // 1 hour
  LINK_META: 300, // 5 minutes
  NEGATIVE: 300, // 5 minutes (not found cache)
  BANNED: 86400, // 24 hours
  QR_CODE: 86400, // 24 hours
  GEO: 86400 // 24 hours
} as const;

// Key prefixes
export const CACHE_PREFIX = {
  LINK: 'link:',
  LINK_META: 'link:meta:',
  LINK_404: 'link:404:',
  LINK_BANNED: 'link:banned:',
  QR_CODE: 'qr:',
  GEO: 'geo:',
  LOCK: 'lock:link:'
} as const;

/**
 * Utility function to scan Redis keys using cursor-based iteration
 * Avoids blocking KEYS command at scale
 * @param pattern - Pattern to match (e.g., 'qr:abc123:*')
 * @param count - Number of keys to scan per iteration (default: 100)
 * @returns Array of matching keys
 */
export async function scanKeys(
  pattern: string,
  count = 100
): Promise<string[]> {
  const redis = getRedisClient();
  const keys: string[] = [];
  let cursor = '0';

  do {
    // SCAN returns [nextCursor, keys]
    const result = (await redis.send('SCAN', [
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      String(count)
    ])) as [string, string[]];

    cursor = result[0];
    const batchKeys = result[1];

    if (batchKeys.length > 0) {
      keys.push(...batchKeys);
    }
  } while (cursor !== '0');

  return keys;
}

/**
 * Service for cache operations related to the redirect engine
 */
export class CacheService {
  private getRedis() {
    return getRedisClient();
  }

  /**
   * Fetch a link from cache with Probabilistic Early Expiration
   * 10% chance to refresh when TTL < 10% of original
   *
   * @param code - Link short code
   * @param enableProbabilisticRefresh - Whether to apply early expiration (default: true)
   * @returns Cached link or null
   */
  async getLink(
    code: string,
    enableProbabilisticRefresh = true
  ): Promise<CachedLink | null> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK}${code}`;
      const cached = await redis.get(key);

      if (!cached) {
        logger.debug('Cache miss', { code, key });
        return null;
      }

      // Probabilistic Early Expiration
      // When TTL < 10% of original, 10% chance to force refresh
      if (enableProbabilisticRefresh) {
        const parsed = JSON.parse(cached) as CachedLink;
        const originalTtl = CACHE_TTL.LINK; // 3600 seconds

        // Compute remaining TTL from the embedded write timestamp
        // This avoids an extra Redis RTT call to TTL
        let remainingTtl: number;
        const cachedAt = parsed._cachedAt;

        if (typeof cachedAt === 'number' && cachedAt > 0) {
          const elapsed = (Date.now() - cachedAt) / 1000;
          remainingTtl = Math.max(0, originalTtl - elapsed);
        } else {
          // Backward compatibility for entries cached before _cachedAt existed.
          // During transition, read actual TTL from Redis to preserve correctness.
          const ttl = await redis.ttl(key);
          remainingTtl = ttl > 0 ? ttl : originalTtl;
        }

        if (remainingTtl < originalTtl * 0.1 && Math.random() < 0.1) {
          logger.debug('Probabilistic early expiration triggered', {
            code,
            remainingTtl: Math.round(remainingTtl),
            threshold: originalTtl * 0.1
          });
          // Return null to force refresh in background
          return null;
        }

        logger.debug('Cache hit', { code, key });
        return parsed;
      }

      logger.debug('Cache hit', { code, key });
      return JSON.parse(cached) as CachedLink;
    } catch (error) {
      logger.error('Error getting link from cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Store a link in cache
   */
  async setLink(code: string, link: CachedLink): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK}${code}`;
      const withTimestamp = { ...link, _cachedAt: Date.now() };
      await redis.setex(key, CACHE_TTL.LINK, JSON.stringify(withTimestamp));
      logger.debug('Link cached', { code, ttl: CACHE_TTL.LINK });
    } catch (error) {
      logger.error('Error setting link in cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if a code is in the negative cache (404)
   */
  async isNotFound(code: string): Promise<boolean> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK_404}${code}`;
      const exists = (await redis.send('EXISTS', [key])) as number;
      return exists === 1;
    } catch (error) {
      logger.error('Error checking 404 cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Mark a code as not found (negative cache)
   */
  async setNotFound(code: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK_404}${code}`;
      await redis.setex(key, CACHE_TTL.NEGATIVE, '1');
      logger.debug('404 cached', { code, ttl: CACHE_TTL.NEGATIVE });
    } catch (error) {
      logger.error('Error setting 404 cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if a link is banned in cache
   */
  async isBanned(code: string): Promise<boolean> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK_BANNED}${code}`;
      const exists = (await redis.send('EXISTS', [key])) as number;
      return exists === 1;
    } catch (error) {
      logger.error('Error checking banned cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Mark a link as banned
   */
  async setBanned(code: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK_BANNED}${code}`;
      await redis.setex(key, CACHE_TTL.BANNED, '1');
      logger.debug('Banned link cached', { code, ttl: CACHE_TTL.BANNED });
    } catch (error) {
      logger.error('Error setting banned cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Invalidate all cache entries related to a link
   */
  async invalidateLink(code: string): Promise<void> {
    try {
      const redis = this.getRedis();
      // Execute commands sequentially (Bun RedisClient doesn't support pipeline)
      const commands = [
        redis.del(`${CACHE_PREFIX.LINK}${code}`),
        redis.del(`${CACHE_PREFIX.LINK_META}${code}`),
        redis.del(`${CACHE_PREFIX.LINK_404}${code}`),
        redis.del(`${CACHE_PREFIX.LINK_BANNED}${code}`)
      ];

      // Remove related QR codes using the tracking Set (O(M) vs O(N) SCAN)
      const qrSetKey = `qr:keys:${code}`;
      const qrKeys = (await redis.send('SMEMBERS', [qrSetKey])) as string[];

      if (qrKeys.length > 0) {
        commands.push(redis.del(...qrKeys, qrSetKey));
      } else {
        // Clean up the set key just in case
        commands.push(redis.del(qrSetKey));
      }

      await Promise.all(commands);

      logger.info('Link cache invalidated', {
        code,
        qrKeysRemoved: qrKeys.length
      });
    } catch (error) {
      logger.error('Error invalidating link cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Invalidate cache after banning a link
   */
  async invalidateAndBan(code: string): Promise<void> {
    try {
      await this.invalidateLink(code);
      await this.setBanned(code);
      logger.info('Link banned and cache invalidated', { code });
    } catch (error) {
      logger.error('Error in invalidateAndBan', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Invalidate cache after deleting a link
   */
  async invalidateAndMarkDeleted(code: string): Promise<void> {
    try {
      await this.invalidateLink(code);
      await this.setNotFound(code);
      logger.info('Link deleted and cache invalidated', { code });
    } catch (error) {
      logger.error('Error in invalidateAndMarkDeleted', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    memory: string;
    keys: number;
    hitRate: number | null;
  }> {
    try {
      const redis = this.getRedis();
      const [info, memory, dbsize] = await Promise.all([
        redis.send('INFO', ['stats']) as Promise<string>,
        redis.send('INFO', ['memory']) as Promise<string>,
        redis.send('DBSIZE', []) as Promise<number>
      ]);

      // Parse the information
      const stats = this.parseRedisInfo(String(info));
      const memoryStats = this.parseRedisInfo(String(memory));

      const hits = Number.parseInt(stats.keyspace_hits || '0', 10);
      const misses = Number.parseInt(stats.keyspace_misses || '0', 10);
      const total = hits + misses;

      return {
        memory: memoryStats.used_memory_human || 'unknown',
        keys: typeof dbsize === 'number' ? dbsize : 0,
        hitRate: total > 0 ? (hits / total) * 100 : null
      };
    } catch (error) {
      logger.error('Error getting cache stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { memory: 'unknown', keys: 0, hitRate: null };
    }
  }

  /**
   * Helper to parse Redis INFO
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key.trim()] = value.trim();
        }
      }
    }

    return result;
  }

  /**
   * Lua script that atomically increments clicksCount in a cached link JSON.
   * Eliminates the GET-modify-SETEX race condition and reduces RTTs from 3 to 1.
   */
  private static readonly INCREMENT_CLICKS_LUA = `
local key = KEYS[1]
local defaultTtl = tonumber(ARGV[1])
local amount = tonumber(ARGV[2]) or 1
local cached = redis.call('GET', key)
if not cached then return nil end
local link = cjson.decode(cached)
link.clicksCount = (link.clicksCount or 0) + amount
local ttl = redis.call('TTL', key)
if ttl < 1 then ttl = defaultTtl end
redis.call('SETEX', key, ttl, cjson.encode(link))
return link.clicksCount
`;

  /**
   * Atomically increment click count in cache using a Lua script.
   * Used by click.worker to keep cache in sync with the DB.
   *
   * @param code - Short code of the link
   * @param amount - Number to increment by (default: 1)
   * @returns The new counter value, or null if link is not in cache
   */
  async incrementClicksCount(code: string, amount = 1): Promise<number | null> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK}${code}`;

      const result = await redis.send('EVAL', [
        CacheService.INCREMENT_CLICKS_LUA,
        '1',
        key,
        String(CACHE_TTL.LINK),
        String(amount)
      ]);

      if (result === null || result === undefined) {
        logger.debug('Cannot increment clicks - link not in cache', { code });
        return null;
      }

      const newClicksCount = Number(result);
      logger.debug('Clicks count incremented in cache (atomic)', {
        code,
        newClicksCount
      });

      return newClicksCount;
    } catch (error) {
      logger.error('Error incrementing clicks count in cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      // Do not propagate errors - cache will refresh on next DB read
      return null;
    }
  }

  /**
   * Flush cache for tests or maintenance
   * ⚠️ USE WITH CARE - Removes ALL Redis keys
   */
  async flushAll(): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.send('FLUSHALL', []);
      logger.warn('Cache flushed - ALL keys removed');
    } catch (error) {
      logger.error('Error flushing cache', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Flush only link-related keys
   */
  async flushLinks(): Promise<void> {
    try {
      const redis = this.getRedis();
      const patterns = [
        `${CACHE_PREFIX.LINK}*`,
        `${CACHE_PREFIX.LINK_META}*`,
        `${CACHE_PREFIX.LINK_404}*`,
        `${CACHE_PREFIX.LINK_BANNED}*`
      ];

      let totalRemoved = 0;

      for (const pattern of patterns) {
        const keys = await scanKeys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          totalRemoved += keys.length;
        }
      }

      logger.info('Link cache flushed', { keysRemoved: totalRemoved });
    } catch (error) {
      logger.error('Error flushing link cache', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
