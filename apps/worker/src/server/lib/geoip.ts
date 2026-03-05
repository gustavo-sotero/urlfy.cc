import { createHash } from 'node:crypto';
import { Reader } from '@maxmind/geoip2-node';
import type ReaderModel from '@maxmind/geoip2-node/dist/src/readerModel';
import { getEnv } from '@/lib/env';
import { CACHE_KEYS, CACHE_TTL, redis } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('geoip');

// Singleton do reader
let readerInstance: ReaderModel | null = null;

export async function getGeoIPReader(): Promise<ReaderModel | null> {
  if (readerInstance) return readerInstance;

  const dbPath = getEnv().GEOIP_DB_PATH;

  try {
    readerInstance = await Reader.open(dbPath);
    logger.info('GeoIP reader initialized', { dbPath });
    return readerInstance;
  } catch (error) {
    logger.error('Failed to open GeoIP database', {
      error: error instanceof Error ? error.message : 'Unknown error',
      dbPath
    });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESULT INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface GeoLocation {
  country: string | null; // ISO code (BR, US, etc.)
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// CACHED LOOKUP
// ═══════════════════════════════════════════════════════════════════

export async function lookupGeoIP(ip: string): Promise<GeoLocation> {
  const defaultLocation: GeoLocation = {
    country: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null
  };

  // Check if IP is private
  if (isPrivateIP(ip)) {
    return defaultLocation;
  }

  // Cache by /24 prefix to optimize
  const ipPrefix = getIPPrefix(ip);
  const cacheKey = CACHE_KEYS.GEO(ipPrefix);

  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from GeoLite2 (via auto-downloaded MMDB)
    const reader = await getGeoIPReader();
    if (!reader) {
      return defaultLocation;
    }

    // GeoLite2 Reader API (MaxMind format)
    const cityData = await reader.city(ip);

    const location: GeoLocation = {
      country: cityData.country?.isoCode || null,
      city: cityData.city?.names?.en || null,
      latitude: cityData.location?.latitude || null,
      longitude: cityData.location?.longitude || null,
      timezone: cityData.location?.timeZone || null
    };

    // Cache result
    await redis.setex(cacheKey, CACHE_TTL.GEO, JSON.stringify(location));

    return location;
  } catch (error) {
    logger.warn('GeoIP lookup failed', {
      ip: anonymizeIP(ip),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return defaultLocation;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  return privateRanges.some((range) => range.test(ip));
}

function getIPPrefix(ip: string): string {
  // IPv4: return /24 prefix (xxx.xxx.xxx)
  if (ip.includes('.')) {
    return ip.split('.').slice(0, 3).join('.');
  }
  // IPv6: return /48 prefix (simplified)
  return ip.split(':').slice(0, 3).join(':');
}

function anonymizeIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Weekly rotating salt for visitor hash
export function getWeeklySalt(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
