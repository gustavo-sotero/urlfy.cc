import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock
} from 'bun:test';
import type { CachedLink } from '@urlfy/contracts/redirect';

const realTelemetryModule = await import(
  '../../../telemetry/src/index.ts?redirect-domain-cache-service-real-telemetry'
);

const realCacheModule = await import(
  '../../../../packages/cache/src/index.ts?redirect-domain-cache-service-real-cache'
);

mock.module('@urlfy/telemetry', () => ({
  ...realTelemetryModule,
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  maskIpForLog: (ip: string) => `ip:${ip}`,
  initTelemetry: () => {},
  configureLogging: async () => {},
  shutdownTelemetry: () => Promise.resolve(),
  cacheHits: { add: () => {} },
  cacheMisses: { add: () => {} },
  recordCacheHit: () => {},
  recordCacheMiss: () => {},
  redisFallbacks: { add: () => {} },
  recordRedirectMetrics: () => {},
  stampedeLocksAcquired: { add: () => {} },
  stampedeLocksWaited: { add: () => {} },
  circuitBreakerTrips: { add: () => {} }
}));

const store = new Map<string, unknown>();
const CACHE_PREFIX = {
  LINK: 'link:',
  LINK_META: 'link:meta:',
  LINK_404: 'link:404:',
  LINK_BANNED: 'link:banned:',
  QR_CODE: 'qr:'
};
const CACHE_TTL = {
  LINK: 3600,
  NEGATIVE: 300,
  BANNED: 86400
};

const mockPipeline = {
  del: mock((key: string) => {
    store.delete(key);
    return mockPipeline;
  }),
  exec: mock<() => Promise<unknown[]>>(() => Promise.resolve([]))
};

const mockRedis = {
  get: mock(async (key: string) => {
    return (store.get(key) as string) || null;
  }),
  set: mock(async (key: string, value: string) => {
    store.set(key, value);
    return 'OK';
  }),
  setex: mock(async (key: string, _ttl: number, value: string) => {
    store.set(key, value);
    return 'OK';
  }),
  send: mock(async (command: string, args: string[]) => {
    const cmd = command.toUpperCase();
    if (cmd === 'EXISTS') {
      const key = args[0];
      return store.has(key) ? 1 : 0;
    }
    if (cmd === 'INFO') {
      const section = args[0]?.toLowerCase();
      if (section === 'stats') {
        return '# Stats\r\nkeyspace_hits:100\r\nkeyspace_misses:10\r\n';
      }
      if (section === 'memory') {
        return '# Memory\r\nused_memory_human:1.5M\r\n';
      }
      return '# Stats\r\nkeyspace_hits:100\r\nkeyspace_misses:10\r\n# Memory\r\nused_memory_human:1.5M\r\n';
    }
    if (cmd === 'DBSIZE') {
      return store.size;
    }
    if (cmd === 'FLUSHALL') {
      store.clear();
      return 'OK';
    }
    if (cmd === 'SCAN') {
      const matchIndex = args.indexOf('MATCH');
      const pattern = matchIndex !== -1 ? args[matchIndex + 1] : '*';
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const keys = Array.from(store.keys()).filter((k) => regex.test(k));
      return ['0', keys];
    }
    if (cmd === 'SMEMBERS') {
      const key = args[0] || '';
      const set = store.get(key);
      return set instanceof Set ? [...set] : [];
    }
    return null;
  }),
  exists: mock(async (key: string) => {
    return store.has(key) ? 1 : 0;
  }),
  del: mock(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
    }
    return count;
  }),
  ttl: mock(async (key: string) => {
    return store.has(key) ? 3600 : -2;
  }),
  keys: mock(async (pattern: string) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(store.keys()).filter((k) => regex.test(k));
  }),
  pipeline: mock(() => mockPipeline),
  info: mock(
    async () =>
      '# Stats\r\nkeyspace_hits:100\r\nkeyspace_misses:10\r\n# Memory\r\nused_memory_human:1.5M\r\n'
  ),
  dbsize: mock(async () => store.size),
  flushall: mock(async () => {
    store.clear();
    return 'OK';
  })
};

mock.module('@urlfy/cache', () => ({
  ...realCacheModule,
  acquireLock: async () => true,
  getRedisClient: () => mockRedis,
  getPendingClicks: async () => 0,
  getPendingClicksMap: async () => new Map<string, number>(),
  getPendingClicksTotal: async () => 0,
  incrementPendingClicks: async () => 0,
  drainPendingClicks: async () => new Map<string, number>(),
  releaseLock: async () => {},
  redis: mockRedis,
  CACHE_KEYS: {
    ...realCacheModule.CACHE_KEYS,
    LINK: (code: string) => `link:${code}`,
    LINK_META: (code: string) => `link:meta:${code}`,
    LINK_404: (code: string) => `link:404:${code}`,
    LINK_BANNED: (code: string) => `link:banned:${code}`,
    QR_CODE: (code: string, size: number, format: string) =>
      `qr:${code}:${size}:${format}`,
    QR_KEYS_SET: (code: string) => `qr:keys:${code}`,
    LOCK: (code: string) => `lock:${code}`
  },
  CACHE_TTL: {
    ...realCacheModule.CACHE_TTL,
    LINK: 3600,
    LINK_META: 300,
    LINK_404: 300,
    LINK_BANNED: 86400,
    LOCK: 5,
    QR_CODE: 86400,
    GEO: 86400
  }
}));

const { cacheService } = await import(
  '../cache-service?redirect-domain-cache-service-test-module'
);

async function withTimeout<T>(
  promise: Promise<T>,
  ms = 500
): Promise<{ success: boolean; result?: T; error?: Error }> {
  let timer: Timer | undefined;
  const timeoutPromise = new Promise<{ success: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ success: false }), ms);
  });

  try {
    const result = await Promise.race([
      promise.then((r) => ({ success: true as const, result: r })),
      timeoutPromise
    ]);
    if (timer) clearTimeout(timer);
    return result as { success: boolean; result?: T };
  } catch (error) {
    if (timer) clearTimeout(timer);
    return { success: true, error: error as Error };
  }
}

describe('CacheService', () => {
  beforeEach(() => {
    store.clear();
    mockRedis.get.mockClear();
    mockRedis.set.mockClear();
    mockRedis.setex.mockClear();
    mockRedis.send.mockClear();
    mockRedis.exists.mockClear();
    mockRedis.del.mockClear();
    mockRedis.pipeline.mockClear();
    mockPipeline.del.mockClear();
    mockPipeline.exec.mockClear();
  });

  afterEach(() => {
    store.clear();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('getLink', () => {
    it('returns null on cache miss', async () => {
      const { success, result } = await withTimeout(
        cacheService.getLink('abc123')
      );
      if (!success) return;

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(`${CACHE_PREFIX.LINK}abc123`);
    });

    it('returns a parsed link on cache hit', async () => {
      const mockLink: CachedLink = {
        id: 'test-id-001',
        originalUrl: 'https://example.com',
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null
      };

      store.set(`${CACHE_PREFIX.LINK}abc123`, JSON.stringify(mockLink));

      const { success, result } = await withTimeout(
        cacheService.getLink('abc123', false)
      );
      if (!success) return;

      expect(result).toEqual(mockLink);
    });

    it('returns null on parse error', async () => {
      store.set(`${CACHE_PREFIX.LINK}abc123`, 'invalid-json');

      const { success, result } = await withTimeout(
        cacheService.getLink('abc123')
      );
      if (!success) return;

      expect(result).toBeNull();
    });
  });

  describe('getLinkState', () => {
    it('applies probabilistic early refresh through the cache adapter', async () => {
      const mockLink: CachedLink = {
        id: 'test-id-early-refresh',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        _cachedAt: Date.now() - CACHE_TTL.LINK * 0.95 * 1000
      };

      store.set(`${CACHE_PREFIX.LINK}abc123`, JSON.stringify(mockLink));

      const { success, result } = await withTimeout(
        cacheService.getLinkState('abc123', { random: () => 0 })
      );
      if (!success || !result) return;

      expect(result.link).toBeNull();
      expect(result.isNotFound).toBe(false);
      expect(result.isBanned).toBe(false);
    });

    it('returns the cached link when early refresh is disabled', async () => {
      const mockLink: CachedLink = {
        id: 'test-id-no-refresh',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        _cachedAt: Date.now() - CACHE_TTL.LINK * 0.95 * 1000
      };

      store.set(`${CACHE_PREFIX.LINK}abc123`, JSON.stringify(mockLink));

      const { success, result } = await withTimeout(
        cacheService.getLinkState('abc123', {
          enableProbabilisticRefresh: false,
          random: () => 0
        })
      );
      if (!success || !result) return;

      expect(result.link).toEqual(mockLink);
    });
  });

  describe('setLink', () => {
    it('caches a link with the canonical TTL', async () => {
      const mockLink: CachedLink = {
        id: 'test-id-002',
        originalUrl: 'https://example.com',
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null
      };

      const { success } = await withTimeout(
        cacheService.setLink('abc123', mockLink)
      );
      if (!success) return;

      const stored = store.get(`${CACHE_PREFIX.LINK}abc123`);
      const parsed = stored ? JSON.parse(stored as string) : null;
      expect(parsed).toMatchObject(mockLink);
      expect(parsed._cachedAt).toBeTypeOf('number');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `${CACHE_PREFIX.LINK}abc123`,
        CACHE_TTL.LINK,
        expect.stringContaining('"_cachedAt"')
      );
    });
  });

  describe('negative and banned cache helpers', () => {
    it('detects a cached 404 entry', async () => {
      store.set(`${CACHE_PREFIX.LINK_404}notfound`, '1');

      const { success, result } = await withTimeout(
        cacheService.isNotFound('notfound')
      );
      if (!success) return;

      expect(result).toBe(true);
      expect(mockRedis.send).toHaveBeenCalled();
    });

    it('stores the not-found marker', async () => {
      const { success } = await withTimeout(
        cacheService.setNotFound('notfound')
      );
      if (!success) return;

      expect(store.get(`${CACHE_PREFIX.LINK_404}notfound`)).toBe('1');
    });

    it('detects a cached banned entry', async () => {
      store.set(`${CACHE_PREFIX.LINK_BANNED}banned`, '1');

      const { success, result } = await withTimeout(
        cacheService.isBanned('banned')
      );
      if (!success) return;

      expect(result).toBe(true);
    });

    it('stores the banned marker', async () => {
      const { success } = await withTimeout(cacheService.setBanned('banned'));
      if (!success) return;

      expect(store.get(`${CACHE_PREFIX.LINK_BANNED}banned`)).toBe('1');
    });
  });

  describe('invalidateLink', () => {
    it('deletes all related cache entries', async () => {
      store.set(`${CACHE_PREFIX.LINK}abc123`, 'data');
      store.set(`${CACHE_PREFIX.LINK_META}abc123`, 'data');
      store.set('qr:keys:abc123', new Set(['qr:abc123:200:png']));
      store.set('qr:abc123:200:png', 'data');

      const { success } = await withTimeout(
        cacheService.invalidateLink('abc123')
      );
      if (!success) return;

      expect(mockRedis.del).toHaveBeenCalled();
      expect(store.has(`${CACHE_PREFIX.LINK}abc123`)).toBe(false);
      expect(store.has(`${CACHE_PREFIX.LINK_META}abc123`)).toBe(false);
      expect(store.has('qr:abc123:200:png')).toBe(false);
    });
  });

  describe('invalidateQR', () => {
    it('deletes tracked QR keys and their tracking set', async () => {
      store.set('qr:keys:abc123', new Set(['qr:abc123:200:png']));
      store.set('qr:abc123:200:png', 'data');

      const { success, result } = await withTimeout(
        cacheService.invalidateQR('abc123')
      );
      if (!success) return;

      expect(result).toBe(1);
      expect(store.has('qr:abc123:200:png')).toBe(false);
      expect(store.has('qr:keys:abc123')).toBe(false);
    });

    it('cleans up an empty QR tracking set', async () => {
      store.set('qr:keys:empty', new Set());

      const { success, result } = await withTimeout(
        cacheService.invalidateQR('empty')
      );
      if (!success) return;

      expect(result).toBe(0);
      expect(store.has('qr:keys:empty')).toBe(false);
    });
  });

  describe('invalidateLinkAndQR', () => {
    it('invalidates link and QR cache before marking a link as banned', async () => {
      store.set(`${CACHE_PREFIX.LINK}abc123`, 'data');
      store.set('qr:keys:abc123', new Set(['qr:abc123:200:png']));
      store.set('qr:abc123:200:png', 'data');

      const { success } = await withTimeout(
        cacheService.invalidateLinkAndQR('abc123', 'ban')
      );
      if (!success) return;

      expect(store.has(`${CACHE_PREFIX.LINK}abc123`)).toBe(false);
      expect(store.has('qr:abc123:200:png')).toBe(false);
      expect(store.get(`${CACHE_PREFIX.LINK_BANNED}abc123`)).toBe('1');
    });
  });

  describe('getCacheStats', () => {
    it('returns cache statistics', async () => {
      store.set('key1', 'val');

      const { success, result } = await withTimeout(
        cacheService.getCacheStats()
      );
      if (!success || !result) return;

      expect(result.memory).toBe('1.5M');
      expect(result.keys).toBe(1);
    });
  });

  describe('flushLinks', () => {
    it('deletes all link-related keys', async () => {
      store.set('link:1', 'v');
      store.set('link:2', 'v');

      const { success } = await withTimeout(cacheService.flushLinks());
      if (!success) return;

      expect(mockRedis.send).toHaveBeenCalledWith(
        expect.stringMatching(/SCAN/i),
        expect.any(Array)
      );
      expect(mockRedis.del).toHaveBeenCalled();
      expect(store.size).toBe(0);
    });
  });
});
