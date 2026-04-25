import { createLogger } from '@urlfy/telemetry';
import { getRedisClient } from './client';
import { CACHE_KEYS, CACHE_TTL } from './keys';

const logger = createLogger('realtime-clicks');

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 1;
  }

  return Math.trunc(amount);
}

export async function incrementPendingClicks(
  linkId: string,
  amount = 1
): Promise<number | null> {
  try {
    const redis = getRedisClient();
    const key = CACHE_KEYS.ANALYTICS_PENDING_CLICKS(linkId);
    const normalizedAmount = normalizeAmount(amount);
    const nextValue = Number(
      await redis.send('INCRBY', [key, String(normalizedAmount)])
    );

    await redis.expire(key, CACHE_TTL.ANALYTICS_PENDING_CLICKS);

    return Number.isFinite(nextValue) ? nextValue : 0;
  } catch (error) {
    logger.warn('Failed to increment pending clicks', {
      linkId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function drainPendingClicks(
  linkId: string,
  amount = 1
): Promise<number | null> {
  try {
    const redis = getRedisClient();
    const key = CACHE_KEYS.ANALYTICS_PENDING_CLICKS(linkId);
    const normalizedAmount = normalizeAmount(amount);
    const remaining = Number(
      await redis.send('DECRBY', [key, String(normalizedAmount)])
    );

    if (!Number.isFinite(remaining) || remaining <= 0) {
      await redis.del(key);
      return 0;
    }

    await redis.expire(key, CACHE_TTL.ANALYTICS_PENDING_CLICKS);

    return remaining;
  } catch (error) {
    logger.warn('Failed to drain pending clicks', {
      linkId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function getPendingClicks(linkId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(CACHE_KEYS.ANALYTICS_PENDING_CLICKS(linkId));

    if (!value) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch (error) {
    logger.warn('Failed to read pending clicks', {
      linkId,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

export async function getPendingClicksMap(
  linkIds: string[]
): Promise<Map<string, number>> {
  const uniqueLinkIds = [...new Set(linkIds.filter(Boolean))];

  if (uniqueLinkIds.length === 0) {
    return new Map();
  }

  try {
    const redis = getRedisClient();
    const keys = uniqueLinkIds.map((linkId) =>
      CACHE_KEYS.ANALYTICS_PENDING_CLICKS(linkId)
    );
    const values = (await redis.send('MGET', keys)) as Array<string | null>;
    const counts = new Map<string, number>();

    for (let index = 0; index < uniqueLinkIds.length; index++) {
      const parsed = Number(values[index] ?? '0');

      if (Number.isFinite(parsed) && parsed > 0) {
        counts.set(uniqueLinkIds[index], parsed);
      }
    }

    return counts;
  } catch (error) {
    logger.warn('Failed to read pending clicks map', {
      linkIds: uniqueLinkIds.length,
      error: error instanceof Error ? error.message : String(error)
    });
    return new Map();
  }
}

export async function getPendingClicksTotal(
  linkIds: string[]
): Promise<number> {
  const counts = await getPendingClicksMap(linkIds);

  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }

  return total;
}
