// src/server/services/qr.service.ts

import QRCode from 'qrcode';
import { createLogger } from '@/server/lib/telemetry';
import { redis } from '../lib/redis';

const logger = createLogger('qr-service');

type QRFormat = 'png' | 'svg';
type QRSize = 100 | 200 | 300 | 500 | 1000;

const CACHE_TTL = 86400; // 24 hours

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
  const cacheKey = `qr:${code}:${size}:${format}`;

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
      await redis.set(cacheKey, result, 'EX', CACHE_TTL);
    } catch (error) {
      logger.warn('Failed to cache QR SVG', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    result = await QRCode.toBuffer(shortUrl, { ...options, type: 'png' });

    try {
      await redis.set(cacheKey, result.toString('base64'), 'EX', CACHE_TTL);
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
    // Use SCAN instead of KEYS to avoid blocking Redis
    const keys: string[] = [];
    let cursor = '0';
    const pattern = `qr:${code}:*`;

    do {
      const result = (await redis.send('SCAN', [
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '100'
      ])) as [string, string[]];

      cursor = result[0];
      const batchKeys = result[1];

      if (batchKeys.length > 0) {
        keys.push(...batchKeys);
      }
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn('Failed to invalidate QR cache', {
      code,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Validate QR code size
 * @param size - Requested size
 * @returns Validated size or default
 */
export function validateQRSize(size: number): QRSize {
  const validSizes: QRSize[] = [100, 200, 300, 500, 1000];

  if (validSizes.includes(size as QRSize)) {
    return size as QRSize;
  }

  // Return the closest valid size
  return validSizes.reduce((prev, curr) =>
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
  );
}

/**
 * Validate QR code format
 * @param format - Requested format
 * @returns Validated format or default
 */
export function validateQRFormat(format: string): QRFormat {
  return format === 'svg' ? 'svg' : 'png';
}
