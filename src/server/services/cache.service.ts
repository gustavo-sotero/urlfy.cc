// src/server/services/cache.service.ts

import { getRedisClient } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { CachedLink } from '@/types/redirect.types';

const logger = createLogger('cache-service');

// TTLs de cache (em segundos)
export const CACHE_TTL = {
  LINK: 3600, // 1 hora
  LINK_META: 300, // 5 minutos
  NEGATIVE: 300, // 5 minutos (cache de link não encontrado)
  BANNED: 86400, // 24 horas
  QR_CODE: 86400, // 24 horas
  GEO: 86400 // 24 horas
} as const;

// Prefixos de chave
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
 * Service para operações de cache relacionadas ao redirect engine
 */
export class CacheService {
  private getRedis() {
    return getRedisClient();
  }

  /**
   * Busca um link no cache com Probabilistic Early Expiration
   * 10% de chance de refresh quando TTL < 10% do original
   *
   * @param code - Short code do link
   * @param enableProbabilisticRefresh - Se deve aplicar early expiration (default: true)
   * @returns Link cacheado ou null
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
      // Quando TTL < 10% do original, 10% de chance de forçar refresh
      if (enableProbabilisticRefresh) {
        const ttl = await redis.ttl(key);
        const originalTtl = CACHE_TTL.LINK; // 3600 segundos

        if (ttl > 0 && ttl < originalTtl * 0.1 && Math.random() < 0.1) {
          logger.debug('Probabilistic early expiration triggered', {
            code,
            ttl,
            threshold: originalTtl * 0.1
          });
          // Retorna null para forçar refresh em background
          return null;
        }
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
   * Armazena um link no cache
   */
  async setLink(code: string, link: CachedLink): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK}${code}`;
      await redis.setex(key, CACHE_TTL.LINK, JSON.stringify(link));
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
   * Verifica se um código está no cache negativo (404)
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
   * Marca um código como não encontrado (cache negativo)
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
   * Verifica se um link está banido no cache
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
   * Marca um link como banido
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
   * Invalida todo o cache relacionado a um link
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

      // Remove QR codes relacionados (pattern delete)
      const qrPattern = `${CACHE_PREFIX.QR_CODE}${code}:*`;
      const qrKeys = redis.keys
        ? await redis.keys(qrPattern)
        : ((await redis.send('KEYS', [qrPattern])) as string[]);

      if (qrKeys.length > 0) {
        commands.push(redis.del(...qrKeys));
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
   * Invalida cache após ban de um link
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
   * Invalida cache após deleção de um link
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
   * Obtém estatísticas de cache
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

      // Parse das informações
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
   * Helper para parsear INFO do Redis
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
   * Incrementa o contador de cliques no cache de forma atômica
   * Usado pelo click.worker para manter o cache sincronizado com o DB
   *
   * @param code - Short code do link
   * @returns O novo valor do contador, ou null se o link não está em cache
   */
  async incrementClicksCount(code: string): Promise<number | null> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX.LINK}${code}`;
      const cached = await redis.get(key);

      if (!cached) {
        // Link não está em cache, nada a fazer
        logger.debug('Cannot increment clicks - link not in cache', { code });
        return null;
      }

      const link = JSON.parse(cached) as CachedLink;
      const newClicksCount = (link.clicksCount ?? 0) + 1;

      // Atualiza o objeto com o novo contador
      const updatedLink: CachedLink = {
        ...link,
        clicksCount: newClicksCount
      };

      // Preserva o TTL restante
      const ttl = await redis.ttl(key);
      const effectiveTtl = ttl > 0 ? ttl : CACHE_TTL.LINK;

      await redis.setex(key, effectiveTtl, JSON.stringify(updatedLink));

      logger.debug('Clicks count incremented in cache', {
        code,
        newClicksCount,
        ttlPreserved: ttl
      });

      return newClicksCount;
    } catch (error) {
      logger.error('Error incrementing clicks count in cache', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      // Não propaga erro - o cache será atualizado na próxima leitura do DB
      return null;
    }
  }

  /**
   * Limpa cache em caso de teste ou manutenção
   * ⚠️ USE COM CUIDADO - Remove TODAS as chaves do Redis
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
   * Limpa apenas as chaves de links
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
        const keys = redis.keys
          ? await redis.keys(pattern)
          : ((await redis.send('KEYS', [pattern])) as string[]);
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
