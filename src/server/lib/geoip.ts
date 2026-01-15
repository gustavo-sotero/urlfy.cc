import { createHash } from 'node:crypto';
import { Reader } from '@maxmind/geoip2-node';
import type ReaderModel from '@maxmind/geoip2-node/dist/src/readerModel';
import { CACHE_KEYS, CACHE_TTL, redis } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('geoip');

// Singleton do reader
let readerInstance: ReaderModel | null = null;

export async function getGeoIPReader(): Promise<ReaderModel | null> {
  if (readerInstance) return readerInstance;

  const dbPath = process.env.MAXMIND_DB_PATH || '/app/geoip/GeoLite2-City.mmdb';

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
// INTERFACE DE RESULTADO
// ═══════════════════════════════════════════════════════════════════

export interface GeoLocation {
  country: string | null; // Código ISO (BR, US, etc)
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// LOOKUP COM CACHE
// ═══════════════════════════════════════════════════════════════════

export async function lookupGeoIP(ip: string): Promise<GeoLocation> {
  const defaultLocation: GeoLocation = {
    country: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null
  };

  // Verifica se é IP privado
  if (isPrivateIP(ip)) {
    return defaultLocation;
  }

  // Cache por prefixo /24 para otimizar
  const ipPrefix = getIPPrefix(ip);
  const cacheKey = CACHE_KEYS.geo(ipPrefix);

  try {
    // Tenta buscar do cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Busca do MaxMind
    const reader = await getGeoIPReader();
    if (!reader) {
      return defaultLocation;
    }

    // MaxMind Reader API
    const cityData = await reader.city(ip);

    const location: GeoLocation = {
      country: cityData.country?.isoCode || null,
      city: cityData.city?.names?.en || null,
      latitude: cityData.location?.latitude || null,
      longitude: cityData.location?.longitude || null,
      timezone: cityData.location?.timeZone || null
    };

    // Cacheia resultado
    await redis.setex(cacheKey, CACHE_TTL.geo, JSON.stringify(location));

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
  // IPv4: retorna /24 (xxx.xxx.xxx)
  if (ip.includes('.')) {
    return ip.split('.').slice(0, 3).join('.');
  }
  // IPv6: retorna /48 (simplificado)
  return ip.split(':').slice(0, 3).join(':');
}

function anonymizeIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Salt rotativo semanal para hash de visitantes
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
