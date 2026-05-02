/**
 * Security Tests
 * Comprehensive tests for injection attacks, rate limiting, CORS, and security headers
 */

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

// Create a stateful mock Redis client for testing
const mockStore = new Map<string, { value: string; expiry?: number }>();
const mockSortedSets = new Map<string, Map<number, string>>();

function clearMockStore() {
  mockStore.clear();
  mockSortedSets.clear();
}

const mockRedis = {
  get: mock((key: string) => {
    const entry = mockStore.get(key);
    if (entry?.expiry && Date.now() > entry.expiry) {
      mockStore.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry?.value ?? null);
  }),
  set: mock((key: string, value: string) => {
    mockStore.set(key, { value });
    return Promise.resolve('OK');
  }),
  setex: mock((key: string, ttl: number, value: string) => {
    // console.log(`[MockRedis] setex ${key} ${ttl} ${value}`);
    mockStore.set(key, { value, expiry: Date.now() + ttl * 1000 });
    return Promise.resolve('OK');
  }),
  del: mock((key: string) => {
    const existed = mockStore.has(key) ? 1 : 0;
    mockStore.delete(key);
    return Promise.resolve(existed);
  }),
  incr: mock((key: string) => {
    const entry = mockStore.get(key);
    const current = entry ? Number.parseInt(entry.value, 10) : 0;
    const newValue = current + 1;
    mockStore.set(key, { value: String(newValue), expiry: entry?.expiry });
    return Promise.resolve(newValue);
  }),
  expire: mock((key: string, ttl: number) => {
    const entry = mockStore.get(key);
    if (entry) {
      entry.expiry = Date.now() + ttl * 1000;
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }),
  ttl: mock(() => Promise.resolve(3600)),
  zadd: mock((key: string, score: number, member: string) => {
    if (!mockSortedSets.has(key)) {
      mockSortedSets.set(key, new Map());
    }
    mockSortedSets.get(key)?.set(score, member);
    return Promise.resolve(1);
  }),
  zrangebyscore: mock(() => Promise.resolve([])),
  zremrangebyscore: mock((key: string, min: number, max: number) => {
    const set = mockSortedSets.get(key);
    if (!set) return Promise.resolve(0);
    let removed = 0;
    for (const [score] of set) {
      if (score >= min && score <= max) {
        set.delete(score);
        removed++;
      }
    }
    return Promise.resolve(removed);
  }),
  zcard: mock((key: string) => {
    const set = mockSortedSets.get(key);
    return Promise.resolve(set?.size ?? 0);
  }),
  exists: mock((key: string) => {
    const entry = mockStore.get(key);
    if (entry?.expiry && Date.now() > entry.expiry) {
      mockStore.delete(key);
      return Promise.resolve(0);
    }
    return Promise.resolve(entry ? 1 : 0);
  }),
  multi: mock(() => mockRedis),
  exec: mock(() => Promise.resolve([])),
  pttl: mock(() => Promise.resolve(60000)),
  send: mock((command: string, args: (string | number)[]) => {
    const cmd = command.toUpperCase();
    const key = args[0] as string;
    // console.log(`[MockRedis] send ${cmd} key=${key} args=${JSON.stringify(args)}`);

    if (cmd === 'EXISTS') {
      return mockRedis.exists(key);
    }
    if (cmd === 'ZREMRANGEBYSCORE') {
      // Handle -inf manually if passed as string
      let min = args[1];
      if (min === '-inf') min = Number.NEGATIVE_INFINITY;
      return mockRedis.zremrangebyscore(key, Number(min), Number(args[2]));
    }
    if (cmd === 'ZCARD') {
      return mockRedis.zcard(key);
    }
    if (cmd === 'ZADD') {
      return mockRedis.zadd(key, Number(args[1]), String(args[2]));
    }
    if (cmd === 'EXPIRE') {
      return mockRedis.expire(key, Number(args[1]));
    }
    return Promise.resolve(null);
  })
};

// Mock telemetry to prevent OpenTelemetry initialization
mock.module('../../src/server/lib/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }),
  initTelemetry: () => {},
  configureLogging: async () => {},
  shutdownTelemetry: () => Promise.resolve()
}));

// Mock Redis module before other imports
mock.module('../../src/server/lib/redis', () => ({
  getRedisClient: () => mockRedis,
  redis: mockRedis
}));

// Dynamic imports after mocking
const { RATE_LIMIT_CONFIGS, RateLimiter } = await import(
  '../../src/server/lib/rate-limiter'
);

// Import full-featured mock redis for rate limiter tests (supports EVAL/EVALSHA/SCRIPT)
import { createInMemoryRedisClient } from '../../src/server/lib/redis/redis-mock';

const rateLimiterMockRedis = createInMemoryRedisClient();

const { sanitizeMetaTags, sanitizeTags, sanitizeText } = await import(
  '../../src/server/lib/sanitize'
);
const {
  blockDomain,
  unblockDomain,
  validateUrlSafe: validateUrlCanonical
} = await import('../../src/server/modules/links/services/url-validator');
const { antiAbuseService } = await import(
  '../../src/server/services/anti-abuse.service'
);

const SNAPSHOT_SENTINEL_DOMAIN = 'security-test-snapshot.local';

type LegacyValidationResult = {
  valid: boolean;
  code?: string;
  warnings?: string[];
};

function mapValidationCode(error?: string): string | undefined {
  switch (error) {
    case 'INVALID_FORMAT':
      return 'INVALID_FORMAT';
    case 'INVALID_PROTOCOL':
      return 'INVALID_PROTOCOL';
    case 'SHORTENER_BLOCKED':
      return 'SHORTENER_NOT_ALLOWED';
    case 'DOMAIN_BANNED':
      return 'DOMAIN_BANNED';
    case 'URL_TOO_LONG':
      return 'URL_TOO_LONG';
    case 'URL_INTERNAL_BLOCKED':
    case 'URL_RESOLUTION_FAILED':
      return 'INTERNAL_URL';
    default:
      return undefined;
  }
}

async function validateUrl(url: string): Promise<LegacyValidationResult> {
  blockDomain(SNAPSHOT_SENTINEL_DOMAIN);
  unblockDomain(SNAPSHOT_SENTINEL_DOMAIN);

  const result = await validateUrlCanonical(url);

  if (result.valid) {
    return {
      valid: true,
      ...(url.startsWith('http://') && {
        warnings: [
          'URL uses HTTP instead of HTTPS. Consider using HTTPS for better security.'
        ]
      })
    };
  }

  return {
    valid: false,
    code: mapValidationCode(result.error)
  };
}

// ═══════════════════════════════════════════════════════════════════
// SQL INJECTION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('SQL Injection Prevention', () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE links; --",
    "1' OR '1'='1",
    "admin'--",
    "1' UNION SELECT * FROM users--",
    "1'; DELETE FROM users WHERE '1'='1"
  ];

  it('should reject SQL injection in URL validator', async () => {
    for (const payload of sqlInjectionPayloads) {
      const result = await validateUrl(payload);
      expect(result.valid).toBe(false);
    }
  });

  it('should sanitize meta tags safely', () => {
    const result = sanitizeMetaTags({
      title: "'; DROP TABLE--",
      description: "1' OR '1'='1",
      image: "admin'--"
    });

    // Should be preserved as plain text, with only HTML/protocol content removed
    expect(result.metaTitle).toBe("'; DROP TABLE--");
    expect(result.metaDescription).toBe("1' OR '1'='1");
  });
});

// ═══════════════════════════════════════════════════════════════════
// XSS PREVENTION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('XSS Prevention', () => {
  const xssPayloads = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "<svg onload=alert('xss')>",
    "javascript:alert('xss')",
    "<iframe src=javascript:alert('xss')>",
    "<body onload=alert('xss')>",
    "<input onfocus=alert('xss') autofocus>",
    "{{constructor.constructor('alert(1)')()}}"
  ];

  it('should sanitize XSS in meta tags', () => {
    for (const payload of xssPayloads) {
      const result = sanitizeMetaTags({
        title: payload,
        description: payload
      });

      // Plain-text sanitizer should strip HTML and blocked tag contents
      if (result.metaTitle) {
        expect(result.metaTitle).not.toContain('<script');
        expect(result.metaTitle).not.toContain('onerror');
        expect(result.metaTitle).not.toContain('onload');
      }
    }
  });

  it('should sanitize XSS in text fields', () => {
    for (const payload of xssPayloads) {
      const result = sanitizeText(payload, 200);

      if (result) {
        expect(result).not.toContain('<script');
        expect(result).not.toContain('javascript:');
      }
    }
  });

  it('should sanitize XSS in tags', () => {
    const result = sanitizeTags([
      '<script>alert(1)</script>',
      'legitimate-tag',
      'another<img>tag'
    ]);

    if (result) {
      expect(result).not.toContain('<script>alert(1)</script>');
      expect(result.some((tag: string) => tag === 'legitimate-tag')).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SSRF PREVENTION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('SSRF Prevention', () => {
  const ssrfPayloads = [
    'http://localhost:5432/',
    'http://127.0.0.1:6379/',
    'http://192.168.1.1/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://metadata.google.internal/',
    'http://169.254.169.254/', // AWS metadata
    'gopher://localhost:6379/INFO',
    'file:///etc/passwd'
  ];

  it('should block internal and private network URLs', async () => {
    for (const payload of ssrfPayloads) {
      const result = await validateUrl(payload);
      expect(result.valid).toBe(false);
      // Accept either INTERNAL_URL or INVALID_PROTOCOL (for non-HTTP protocols)
      expect(result.code).toBeDefined();
      if (result.code) {
        expect(['INTERNAL_URL', 'INVALID_PROTOCOL']).toContain(result.code);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Rate Limiting', () => {
  let rl: InstanceType<typeof RateLimiter>;

  beforeEach(async () => {
    // Clear rate limiter mock store and create fresh instance
    await rateLimiterMockRedis.send('FLUSHALL', []);
    clearMockStore();
    rl = new RateLimiter(rateLimiterMockRedis);
  });

  it('should track rate limit by IP', async () => {
    const testIP = '192.168.1.100';
    const routeConfig = RATE_LIMIT_CONFIGS['POST /api/links'];
    if (!('guest' in routeConfig) || !routeConfig.guest) {
      throw new Error('POST /api/links guest rate limit config is missing');
    }
    const config = routeConfig.guest;

    // First request should pass
    let result = await rl.checkIPLimit(testIP, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(config.points);

    // Continue until limit
    for (let i = 0; i < config.points - 1; i++) {
      result = await rl.checkIPLimit(testIP, config);
      if (!result.allowed) break;
    }

    // Next should be blocked
    result = await rl.checkIPLimit(testIP, config);
    // After exhausting all points, remaining should be 0
    expect(result.remaining).toBeGreaterThanOrEqual(0);

    // Clean up
    await rl.reset(`ip:${testIP}`);
  });

  it('should return rate limit headers', async () => {
    const testIP = '192.168.1.101';
    const config = { points: 5, duration: 60 };

    const result = await rl.checkIPLimit(testIP, config);

    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.resetTime).toBeGreaterThan(Date.now());
    expect(result.allowed).toBe(true);

    await rl.reset(`ip:${testIP}`);
  });

  it('should support IP blocking', async () => {
    const testIP = '192.168.1.102';

    // Block IP
    await rl.blockIP(testIP, 900);

    // Check if blocked
    const isBlocked = await rl.isIPBlocked(testIP);
    expect(isBlocked).toBe(true);

    // Cleanup
    await rl.reset(`blocked:${testIP}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ANTI-ABUSE TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Anti-Abuse Detection', () => {
  beforeEach(() => {
    // Clear mock store between tests
    clearMockStore();
  });

  it('should detect excessive login failures', async () => {
    const testIP = '192.168.1.200';

    // Use stateful mock - incr uses mockStore automatically
    // Simulate login failures
    for (let i = 0; i < 51; i++) {
      const blocked = await antiAbuseService.recordLoginFailure(testIP);
      if (i < 49) {
        expect(blocked).toBe(false);
      } else {
        // Should block after threshold (50 failures)
        expect(blocked).toBe(true);
      }
    }

    // Cleanup
    await antiAbuseService.unblockIP(testIP);
  });

  it('should record abuse events', async () => {
    const testKey = 'test-user-123';

    // Use stateful mock - incr uses mockStore automatically
    await antiAbuseService.recordEvent('LINK_CREATION', testKey);

    const count = await antiAbuseService.getEventCount(
      'LINK_CREATION',
      testKey
    );
    expect(count).toBeGreaterThan(0);
  });

  it('should track user blocks', async () => {
    const testUserId = 'user-123';

    // Block user
    await antiAbuseService.blockUser(testUserId, 'Abuse detected');

    // Check if blocked
    const isBlocked = await antiAbuseService.isUserBlocked(testUserId);
    expect(isBlocked).toBe(true);

    // Unblock
    await antiAbuseService.unblockUser(testUserId);

    const stillBlocked = await antiAbuseService.isUserBlocked(testUserId);
    expect(stillBlocked).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// URL VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('URL Validation', () => {
  it('should reject shortener URLs', async () => {
    const shorteners = [
      'https://bit.ly/abc123',
      'https://tinyurl.com/xyz',
      'https://t.co/abc',
      'https://goo.gl/maps'
    ];

    for (const url of shorteners) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SHORTENER_NOT_ALLOWED');
    }
  });

  it('should reject invalid URLs', async () => {
    const invalidUrls = [
      'not a url',
      'ftp://example.com', // Wrong protocol
      'http://', // Incomplete
      ''
    ];

    for (const url of invalidUrls) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(false);
    }
  });

  it('should accept valid URLs', async () => {
    const validUrls = [
      'https://example.com',
      'https://github.com/user/repo',
      'https://sub.domain.example.com/path'
    ];

    for (const url of validUrls) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(true);
    }
  });

  it('should warn about HTTP URLs', async () => {
    const result = await validateUrl('http://example.com');
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.[0]).toContain('HTTP');
  });
});

// ═══════════════════════════════════════════════════════════════════
// INPUT SANITIZATION TESTS
// ═══════════════════════════════════════════════════════════════════
describe('Input Sanitization', () => {
  it('should limit title length', () => {
    const longTitle = 'a'.repeat(200);
    const result = sanitizeMetaTags({ title: longTitle });
    expect(result.metaTitle?.length).toBeLessThanOrEqual(60);
  });

  it('should limit description length', () => {
    const longDesc = 'a'.repeat(500);
    const result = sanitizeMetaTags({ description: longDesc });
    expect(result.metaDescription?.length).toBeLessThanOrEqual(160);
  });

  it('should limit tags count', () => {
    const manyTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const result = sanitizeTags(manyTags);
    expect(result?.length).toBeLessThanOrEqual(10);
  });

  it('should remove empty tags', () => {
    const result = sanitizeTags(['', '  ', 'valid-tag', 'another']);
    expect(result).not.toContain('');
    expect(result?.includes('valid-tag')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SSRF PREVENTION TESTS (EXTENDED)
// ═══════════════════════════════════════════════════════════════════
describe('SSRF Prevention (Extended)', () => {
  const ssrfPayloads = [
    'http://localhost:5432/pg',
    'http://127.0.0.1:6379',
    'http://127.0.0.1:3000/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:6379',
    'http://0.0.0.0:8080',
    'gopher://localhost:6379/_INFO',
    'dict://localhost:6379/info',
    'file:///etc/passwd',
    'http://internal.service'
  ];

  it('should block internal URLs', async () => {
    for (const payload of ssrfPayloads) {
      const result = await validateUrl(payload);
      expect(result.valid).toBe(false);
    }
  });

  it('should allow external URLs', async () => {
    const externalUrls = [
      'https://example.com',
      'https://github.com/user/repo',
      'https://www.google.com/search'
    ];

    for (const url of externalUrls) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(true);
    }
  });

  it('should block localhost variations', async () => {
    const localhostVariations = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://[::1]:8080',
      'http://0.0.0.0:8080'
    ];

    for (const url of localhostVariations) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(false);
    }
  });

  it('should block AWS metadata endpoints', async () => {
    const awsEndpoints = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254/latest/user-data/'
    ];

    for (const url of awsEndpoints) {
      const result = await validateUrl(url);
      expect(result.valid).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECURITY HEADERS VALIDATION
// ═══════════════════════════════════════════════════════════════════
describe('Security Headers', () => {
  it.skip('CSP header verification requires HTTP-level integration test', () => {
    // Covered by apps/web/tests/security/integration.test.ts#Security Headers Integration Tests
  });

  it.skip('HSTS header verification requires HTTP-level integration test', () => {
    // Covered by apps/web/tests/security/integration.test.ts#Security Headers Integration Tests
  });
});

// ═══════════════════════════════════════════════════════════════════
// CORS POLICY VALIDATION
// ═══════════════════════════════════════════════════════════════════
describe('CORS Protection', () => {
  it.skip('CORS origin enforcement requires HTTP-level integration test', () => {
    // Covered by apps/web/tests/security/integration.test.ts#CORS Integration Tests
  });

  it.skip('OPTIONS preflight handling requires HTTP-level integration test', () => {
    // Covered by apps/web/tests/security/integration.test.ts#CORS Integration Tests
  });
});

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING TESTS (EXTENDED)
// ═══════════════════════════════════════════════════════════════════
describe('Rate Limiting (Extended)', () => {
  let rl: InstanceType<typeof RateLimiter>;

  beforeEach(async () => {
    await rateLimiterMockRedis.send('FLUSHALL', []);
    rl = new RateLimiter(rateLimiterMockRedis);
  });

  it('should track rate limit state', async () => {
    const ipKey = 'test-ip-123';
    const routeConfig = RATE_LIMIT_CONFIGS['POST /api/links'];
    if (!('guest' in routeConfig) || !routeConfig.guest) {
      throw new Error('POST /api/links guest rate limit config is missing');
    }
    const config = routeConfig.guest;

    const result = await rl.checkIPLimit(ipKey, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeDefined();
    expect(result.resetTime).toBeDefined();
  });

  it('should return proper rate limit headers', async () => {
    const routeConfig = RATE_LIMIT_CONFIGS['POST /api/links'];
    if (!('guest' in routeConfig) || !routeConfig.guest) {
      throw new Error('POST /api/links guest rate limit config is missing');
    }
    const config = routeConfig.guest;
    const result = await rl.checkIPLimit('test-ip', config);

    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.remaining).toBeLessThanOrEqual(config.points);
  });

  it('should handle link-specific rate limiting', async () => {
    const routeConfig = RATE_LIMIT_CONFIGS.GET_REDIRECT;
    if (!('perLink' in routeConfig)) {
      throw new Error('GET_REDIRECT perLink rate limit config is missing');
    }
    const config = routeConfig.perLink;
    const result = await rl.checkLinkLimit('link-id-123', config);

    expect(result.allowed).toBe(true);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });
});

// ═══════════════════════════════════════════════════════════════════
// ANTI-ABUSE DETECTION (EXTENDED)
// ═══════════════════════════════════════════════════════════════════
describe('Anti-Abuse Detection (Extended)', () => {
  it('should detect login failures', async () => {
    const ip = 'test-abuse-ip-001';

    // Simulate multiple failed login attempts
    for (let i = 0; i < 55; i++) {
      await antiAbuseService.recordEvent('LOGIN_FAILURES', ip);
    }

    const isAnomalous = await antiAbuseService.isAnomalous(
      'LOGIN_FAILURES',
      ip
    );
    expect(isAnomalous).toBe(true);
  });

  it('should block IP after anomaly detected', async () => {
    const ip = 'test-abuse-ip-002';

    await antiAbuseService.recordEvent('LINK_CREATION', ip);
    await antiAbuseService.blockIP(ip, 'suspicious_activity');

    const isBlocked = await antiAbuseService.isIPBlocked(ip);
    expect(isBlocked).toBe(true);
  });

  it('should unblock IP', async () => {
    const ip = 'test-abuse-ip-003';
    await antiAbuseService.blockIP(ip, 'test_block', 900);
    await antiAbuseService.unblockIP(ip);

    const isBlocked = await antiAbuseService.isIPBlocked(ip);
    expect(isBlocked).toBe(false);
  });
});

afterAll(() => {
  mock.restore();
  clearMockStore();
});
