// src/server/services/qr.service.ts
import QRCode from 'qrcode';
import { redis } from '../lib/redis';

type QRFormat = 'png' | 'svg';
type QRSize = 100 | 200 | 300 | 500 | 1000;

const CACHE_TTL = 86400; // 24 horas

/**
 * Gera QR Code para um link encurtado
 * Cacheia o resultado no Redis por 24h
 *
 * @param shortUrl - URL completa do link encurtado (ex: https://urlfy.cc/abc123)
 * @param code - Short code do link (para cache key)
 * @param size - Tamanho em pixels (100-1000)
 * @param format - Formato de saída (png ou svg)
 * @returns Buffer (PNG) ou string (SVG)
 */
export async function generateQRCode(
  shortUrl: string,
  code: string,
  size: QRSize = 200,
  format: QRFormat = 'png'
): Promise<Buffer | string> {
  const cacheKey = `qr:${code}:${size}:${format}`;

  try {
    // Verifica cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return format === 'svg' ? cached : Buffer.from(cached, 'base64');
    }
  } catch (error) {
    // Se Redis falhar, continua sem cache
    console.warn('Redis unavailable for QR cache:', error);
  }

  // Gera QR Code
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
      console.warn('Failed to cache QR SVG:', error);
    }
  } else {
    result = await QRCode.toBuffer(shortUrl, { ...options, type: 'png' });

    try {
      await redis.set(cacheKey, result.toString('base64'), 'EX', CACHE_TTL);
    } catch (error) {
      console.warn('Failed to cache QR PNG:', error);
    }
  }

  return result;
}

/**
 * Invalida cache de QR codes para um link específico
 * Usado quando o link é editado ou deletado
 *
 * @param code - Short code do link
 */
export async function invalidateQRCache(code: string): Promise<void> {
  try {
    const keys = await redis.keys(`qr:${code}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn('Failed to invalidate QR cache:', error);
  }
}

/**
 * Valida tamanho de QR code
 * @param size - Tamanho solicitado
 * @returns Tamanho validado ou default
 */
export function validateQRSize(size: number): QRSize {
  const validSizes: QRSize[] = [100, 200, 300, 500, 1000];

  if (validSizes.includes(size as QRSize)) {
    return size as QRSize;
  }

  // Retorna o mais próximo
  return validSizes.reduce((prev, curr) =>
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
  );
}

/**
 * Valida formato de QR code
 * @param format - Formato solicitado
 * @returns Formato validado ou default
 */
export function validateQRFormat(format: string): QRFormat {
  return format === 'svg' ? 'svg' : 'png';
}
