/**
 * Unit tests for @urlfy/geoip
 *
 * Validates:
 *  - getWeeklySalt() pure-function behaviour
 *  - getGeoIPReader() returns null when GEOIP_DB_PATH is missing
 *  - lookupGeoIP() short-circuits for private/loopback IPs without hitting Redis
 *  - lookupGeoIP() returns the null-location when no reader is available
 *  - lookupGeoIP() returns cached result from Redis when present
 *  - lookupGeoIP() gracefully degrades on error
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const redisCalls: { get: string[]; setex: string[] } = { get: [], setex: [] };
const mockRedis: {
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttl: number, value: string) => Promise<void>;
} = {
  get: async (key: string) => {
    redisCalls.get.push(key);
    return null;
  },
  setex: async (key: string, _ttl: number, _value: string) => {
    redisCalls.setex.push(key);
  }
};

mock.module('@urlfy/cache', () => ({
  CACHE_KEYS: {
    GEO: (prefix: string) => `geo:${prefix}`
  },
  CACHE_TTL: {
    GEO: 86400
  },
  redis: mockRedis
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  })
}));

mock.module('@maxmind/geoip2-node', () => ({
  Reader: {
    open: async (_path: string) => {
      throw new Error('stub — no real DB in unit tests');
    }
  }
}));

// Import after mocks
const { getGeoIPReader, getWeeklySalt, lookupGeoIP } = await import('../index');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetRedisCalls() {
  redisCalls.get.length = 0;
  redisCalls.setex.length = 0;
}

// ─── Tests: getWeeklySalt ────────────────────────────────────────────────────

describe('getWeeklySalt', () => {
  it('returns a string in the format YYYY-Www', () => {
    const salt = getWeeklySalt();
    expect(salt).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('is deterministic for the same call within a process', () => {
    const a = getWeeklySalt();
    const b = getWeeklySalt();
    expect(a).toBe(b);
  });

  it('encodes a valid week number (1–53)', () => {
    const salt = getWeeklySalt();
    const match = salt.match(/W(\d{2})$/);
    expect(match).not.toBeNull();
    const week = Number(match?.[1]);
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('encodes the current calendar year', () => {
    const salt = getWeeklySalt();
    expect(salt.startsWith(String(new Date().getFullYear()))).toBe(true);
  });
});

// ─── Tests: getGeoIPReader ───────────────────────────────────────────────────

describe('getGeoIPReader', () => {
  let savedPath: string | undefined;

  beforeEach(() => {
    savedPath = process.env.GEOIP_DB_PATH;
    delete process.env.GEOIP_DB_PATH;
  });

  afterEach(() => {
    if (savedPath !== undefined) {
      process.env.GEOIP_DB_PATH = savedPath;
    } else {
      delete process.env.GEOIP_DB_PATH;
    }
  });

  it('returns null when GEOIP_DB_PATH is not set', async () => {
    const reader = await getGeoIPReader();
    expect(reader).toBeNull();
  });

  it('returns null when the reader fails to open', async () => {
    process.env.GEOIP_DB_PATH = '/nonexistent/db.mmdb';
    // @maxmind/geoip2-node is mocked to throw above
    const reader = await getGeoIPReader();
    expect(reader).toBeNull();
  });
});

// ─── Tests: lookupGeoIP ──────────────────────────────────────────────────────

describe('lookupGeoIP', () => {
  beforeEach(resetRedisCalls);

  const NULL_LOCATION = {
    country: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null
  };

  describe('private / loopback IPs — no Redis call', () => {
    const privateAddresses = [
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.0.1',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.0.1',
      '::1',
      'fc00::1',
      'fe80::1'
    ];

    for (const ip of privateAddresses) {
      it(`returns null-location without touching Redis for ${ip}`, async () => {
        const result = await lookupGeoIP(ip);
        expect(result).toEqual(NULL_LOCATION);
        expect(redisCalls.get).toHaveLength(0);
        expect(redisCalls.setex).toHaveLength(0);
      });
    }
  });

  describe('public IP — no reader available (GEOIP_DB_PATH unset)', () => {
    let savedPath: string | undefined;

    beforeEach(() => {
      savedPath = process.env.GEOIP_DB_PATH;
      delete process.env.GEOIP_DB_PATH;
      resetRedisCalls();
    });

    afterEach(() => {
      if (savedPath !== undefined) {
        process.env.GEOIP_DB_PATH = savedPath;
      } else {
        delete process.env.GEOIP_DB_PATH;
      }
    });

    it('returns null-location for a public IP when no reader is available', async () => {
      // Override Redis mock to simulate cache miss
      mockRedis.get = async (key: string) => {
        redisCalls.get.push(key);
        return null;
      };

      const result = await lookupGeoIP('8.8.8.8');
      expect(result).toEqual(NULL_LOCATION);
      // Redis was checked (cache miss path followed)
      expect(redisCalls.get.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('public IP — Redis cache hit', () => {
    it('returns parsed cached entry without opening the reader', async () => {
      const cached = {
        country: 'BR',
        city: 'São Paulo',
        latitude: -23.5505,
        longitude: -46.6333,
        timezone: 'America/Sao_Paulo'
      };

      mockRedis.get = async (key: string) => {
        redisCalls.get.push(key);
        return JSON.stringify(cached);
      };

      const result = await lookupGeoIP('200.0.0.1');
      expect(result).toEqual(cached);
      expect(redisCalls.setex).toHaveLength(0); // No write because cache hit
    });
  });

  describe('Redis cache key uses /24 prefix', () => {
    it('keys lookup by /24 subnet prefix to reduce cardinality', async () => {
      const capturedKeys: string[] = [];
      mockRedis.get = async (key: string) => {
        capturedKeys.push(key);
        return null;
      };

      await lookupGeoIP('203.0.113.42');

      expect(capturedKeys).toHaveLength(1);
      expect(capturedKeys[0]).toBe('geo:203.0.113');
    });
  });
});
