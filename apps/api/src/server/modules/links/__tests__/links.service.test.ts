// src/server/modules/links/__tests__/links.service.test.ts

// ═══════════════════════════════════════════════════════════════════
// CRITICAL: Set environment variables and mock modules BEFORE any imports
// ═══════════════════════════════════════════════════════════════════
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-key-for-testing';

import { afterAll, describe, expect, it, mock } from 'bun:test';

// Mock the database module
const mockLimitFn = mock<() => Promise<Link[]>>(() => Promise.resolve([]));
const createWhereResult = () => ({
  limit: mockLimitFn,
  union: mock(() => ({
    limit: mockLimitFn
  }))
});
const mockWhereFn = mock(() => createWhereResult());
const mockFromFn = mock(() => ({
  where: mockWhereFn
}));
const mockSelectFn = mock(() => ({
  from: mockFromFn
}));
const mockUpdateReturningFn = mock<() => Promise<Link[]>>(() =>
  Promise.resolve([])
);
const mockUpdateWhereFn = mock(() => ({
  returning: mockUpdateReturningFn
}));
const mockUpdateSetFn = mock((_updates: Record<string, unknown>) => ({
  where: mockUpdateWhereFn
}));
const mockUpdateFn = mock(() => ({
  set: mockUpdateSetFn
}));

const mockDb = {
  select: mockSelectFn,
  update: mockUpdateFn,
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(() =>
        Promise.resolve([
          {
            id: 'new-link-id',
            shortCode: 'abc123',
            originalUrl: 'https://example.com'
          }
        ])
      )
    }))
  })),
  query: {
    links: {
      findFirst: mock(() => Promise.resolve(null))
    }
  }
};

mock.module('@urlfy/data', () => ({
  db: mockDb,
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok' as const, latencyMs: 1 })
  ),
  getDatabase: mock(() => mockDb),
  getSQLConnection: mock(() => ({}))
}));

mock.module('@/server/lib/redis', () => ({
  redis: {
    del: mock(() => Promise.resolve(0)),
    send: mock(() => Promise.resolve('OK'))
  }
}));

mock.module('@/server/modules/links/services/qr.service', () => ({
  invalidateQRCache: mock(() => Promise.resolve())
}));

mock.module('@urlfy/data/schema', () => ({
  links: {
    id: 'id',
    shortCode: 'short_code',
    originalUrl: 'original_url',
    userId: 'user_id',
    redirectType: 'redirect_type',
    clicksCount: 'clicks_count',
    maxClicks: 'max_clicks',
    passwordHash: 'password_hash',
    isActive: 'is_active',
    isBanned: 'is_banned',
    expiresAt: 'expires_at',
    metaTitle: 'meta_title',
    metaDescription: 'meta_description',
    metaImage: 'meta_image',
    utmSource: 'utm_source',
    utmMedium: 'utm_medium',
    utmCampaign: 'utm_campaign',
    tags: 'tags',
    notes: 'notes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  },
  reservedSlugs: {
    slug: 'slug'
  },
  bannedUrls: {
    urlPattern: 'url_pattern',
    matchType: 'match_type'
  }
}));

mock.module('@/server/modules/links/services/url-validator', () => ({
  validateUrlAsync: async (url: string) => {
    if (url.length > 2048) {
      return { valid: false, error: 'URL_TOO_LONG' };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { valid: false, error: 'INVALID_FORMAT' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'INVALID_PROTOCOL' };
    }

    const blocked = new Set([
      'bit.ly',
      'tinyurl.com',
      't.co',
      'goo.gl',
      'ow.ly',
      'is.gd',
      'buff.ly',
      'adf.ly',
      'shorturl.at',
      'tiny.cc',
      'rb.gy'
    ]);

    const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (blocked.has(domain)) {
      return { valid: false, error: 'SHORTENER_BLOCKED' };
    }

    return { valid: true };
  }
}));

// Import the real LinkService for testing pure functions
import { LinkService } from '@/server/modules/links/links.service';
import type { Link } from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// PURE FUNCTION TESTS - No database mocking needed
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory function to create mock Link objects for testing
 */
function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    id: `test-id-${Math.random().toString(36).slice(2)}`,
    shortCode: 'abc123',
    originalUrl: 'https://example.com',
    redirectType: 302,
    clicksCount: 0,
    maxClicks: null,
    isActive: true,
    passwordHash: null,
    isBanned: false,
    expiresAt: null,
    metaTitle: null,
    metaDescription: null,
    metaImage: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    tags: null,
    notes: null,
    lastClickedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    userId: null,
    bannedAt: null,
    bannedReason: null,
    qrGeneratedAt: null,
    createdByIpHash: null,
    deletedAt: null,
    ...overrides
  };
}

describe('LinkService - Pure Functions', () => {
  afterAll(() => {
    mock.restore();
  });

  describe('formatLinkResponse', () => {
    it('should include shortUrl with BASE_URL', () => {
      const mockLink = createMockLink({
        shortCode: 'abc123',
        clicksCount: 10
      });

      const response = LinkService.formatLinkResponse(mockLink);

      expect(response.shortUrl).toContain(mockLink.shortCode);
      expect(response.isProtected).toBe(false);
      expect(response.clicksCount).toBe(10);
    });

    it('should mark as protected if has passwordHash', () => {
      const mockLink = createMockLink({
        passwordHash: 'hashed-password'
      });

      const response = LinkService.formatLinkResponse(mockLink);

      expect(response.isProtected).toBe(true);
    });

    it('should preserve nullable metadata fields', () => {
      const mockLink = createMockLink({
        metaTitle: 'Preview title',
        metaDescription: null,
        metaImage: 'https://example.com/image.png'
      });

      const response = LinkService.formatLinkResponse(mockLink);

      expect(response.metaTitle).toBe('Preview title');
      expect(response.metaDescription).toBeNull();
      expect(response.metaImage).toBe('https://example.com/image.png');
    });
  });
});
