// src/server/modules/links/services/qr.service.ts

import { CACHE_KEYS, CACHE_TTL as CANONICAL_CACHE_TTL } from '@urlfy/cache';
import { cacheService } from '@urlfy/redirect-domain/cache-service';
import QRCode from 'qrcode';
import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';
import type { QRFormat, QRSize } from './qr.utils';

export type { QRFormat, QRSize } from './qr.utils';
// Re-export pure utilities so existing consumers keep working
export { validateQRFormat, validateQRSize } from './qr.utils';

const logger = createLogger('qr-service');

/**
 * Generate a QR Code for a shortened link
 * Caches the result in Redis for 24 hours
 *
 * @param shortUrl - Full shortened URL (e.g., https://urlfy.cc/abc123)
 * @param code - Link short code (for cache key)
 * @param size - Size in pixels (100-1000)
 * @param format - Output format (png or svg)
 * @returns Buffer (PNG) or string (SVG)
 */
export async function generateQRCode(
  shortUrl: string,
  code: string,
  size: QRSize = 200,
  format: QRFormat = 'png'
): Promise<Buffer | string> {
  const cacheKey = CACHE_KEYS.QR_CODE(code, size, format);

  try {
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return format === 'svg' ? cached : Buffer.from(cached, 'base64');
    }
  } catch (error) {
    // If Redis fails, continue without cache
    logger.warn('Redis unavailable for QR cache', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Generate QR Code
  const options = {
    width: size,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M' as const
  };

  let result: Buffer | string;

  if (format === 'svg') {
    result = await QRCode.toString(shortUrl, { ...options, type: 'svg' });

    try {
      await redis.set(cacheKey, result, 'EX', CANONICAL_CACHE_TTL.QR_CODE);
      // Track the cache key in a Set for efficient invalidation (O(M) vs O(N) SCAN)
      await redis.send('SADD', [CACHE_KEYS.QR_KEYS_SET(code), cacheKey]);
    } catch (error) {
      logger.warn('Failed to cache QR SVG', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    result = await QRCode.toBuffer(shortUrl, { ...options, type: 'png' });

    try {
      await redis.set(
        cacheKey,
        result.toString('base64'),
        'EX',
        CANONICAL_CACHE_TTL.QR_CODE
      );
      // Track the cache key in a Set for efficient invalidation (O(M) vs O(N) SCAN)
      await redis.send('SADD', [CACHE_KEYS.QR_KEYS_SET(code), cacheKey]);
    } catch (error) {
      logger.warn('Failed to cache QR PNG', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

/**
 * Invalidate QR cache for a specific link
 * Used when the link is edited or deleted
 *
 * @param code - Link short code
 */
export async function invalidateQRCache(code: string): Promise<void> {
  try {
    await cacheService.invalidateQR(code);
  } catch (error) {
    logger.warn('Failed to invalidate QR cache', {
      code,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
