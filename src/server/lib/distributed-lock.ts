// src/server/lib/distributed-lock.ts

import { getRedisClient } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('distributed-lock');
const redis = getRedisClient();

/**
 * Tenta adquirir um lock distribuído usando Redis SETNX
 *
 * @param key - Chave única para o lock
 * @param ttlMs - Tempo de vida do lock em milissegundos
 * @param retries - Número de tentativas (default: 0, não tenta novamente)
 * @param retryDelayMs - Delay entre tentativas em ms (default: 50ms)
 * @returns true se o lock foi adquirido, false caso contrário
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
  retries = 0,
  retryDelayMs = 50
): Promise<boolean> {
  let attempts = 0;
  const maxAttempts = retries + 1;

  while (attempts < maxAttempts) {
    try {
      // SET NX PX: Set if Not eXists + Expiration in milliseconds
      const result = await redis.set(key, '1', 'PX', String(ttlMs), 'NX');

      if (result === 'OK') {
        logger.debug('Lock acquired', { key, ttlMs, attempt: attempts + 1 });
        return true;
      }

      // Lock já existe
      if (attempts < retries) {
        await Bun.sleep(retryDelayMs);
        attempts++;
        continue;
      }

      logger.debug('Lock not acquired', { key, attempts: attempts + 1 });
      return false;
    } catch (error) {
      logger.error('Error acquiring lock', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  return false;
}

/**
 * Libera um lock distribuído
 *
 * @param key - Chave do lock a ser liberado
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    const result = await redis.del(key);
    if (result === 1) {
      logger.debug('Lock released', { key });
    } else {
      logger.warn('Lock not found when releasing', { key });
    }
  } catch (error) {
    logger.error('Error releasing lock', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Executa uma função com lock distribuído
 * Adquire o lock, executa a função e garante que o lock seja liberado
 *
 * @param key - Chave do lock
 * @param ttlMs - Tempo de vida do lock
 * @param fn - Função a ser executada
 * @returns Resultado da função ou null se não conseguir adquirir o lock
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await acquireLock(key, ttlMs);

  if (!acquired) {
    logger.warn('Failed to acquire lock, skipping execution', { key });
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}

/**
 * Verifica se um lock existe
 *
 * @param key - Chave do lock
 * @returns true se o lock existe, false caso contrário
 */
export async function hasLock(key: string): Promise<boolean> {
  try {
    const exists = (await redis.send('EXISTS', [key])) as number;
    return exists === 1;
  } catch (error) {
    logger.error('Error checking lock', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Obtém o TTL restante de um lock em milissegundos
 *
 * @param key - Chave do lock
 * @returns TTL em ms ou -1 se não existir, -2 se não tiver TTL
 */
export async function getLockTTL(key: string): Promise<number> {
  try {
    const ttl = await redis.pttl(key);
    return ttl;
  } catch (error) {
    logger.error('Error getting lock TTL', {
      key,
      error: error instanceof Error ? error.message : String(error)
    });
    return -1;
  }
}
