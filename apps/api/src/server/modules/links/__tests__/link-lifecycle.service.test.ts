/**
 * ═════════════════════════════════════════════════════════════════════
 * LINK LIFECYCLE SERVICE — Unit Tests
 * ═════════════════════════════════════════════════════════════════════
 * Verifies the state machine invariants of soft-delete and restore:
 *
 *   softDeleteLink : sets deletedAt + isActive = false
 *   restoreLink    : clears deletedAt AND sets isActive = true
 *
 * The restore invariant is critical — a restored link must be
 * immediately usable in the redirect path, which checks both
 * `deletedAt IS NULL` and `isActive = true`.
 * ═════════════════════════════════════════════════════════════════════
 */

// ── Env + module mocks must be set before any import ─────────────────────────
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-key-for-testing-min-32-chars';

import { afterAll, describe, expect, it, mock } from 'bun:test';

// ── DB mock ───────────────────────────────────────────────────────────────────

// Tracks the last `set(...)` call so tests can inspect what was written.
let lastUpdateSet: Record<string, unknown> = {};

const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock((_n: number) =>
          Promise.resolve([
            {
              id: 'link-id',
              shortCode: 'abc123',
              userId: 'user-id',
              isActive: true,
              deletedAt: null,
              originalUrl: 'https://example.com'
            }
          ])
        )
      }))
    }))
  })),
  update: mock(() => ({
    set: mock((updates: Record<string, unknown>) => {
      lastUpdateSet = updates;
      return {
        where: mock(() => ({
          returning: mock(() =>
            Promise.resolve([
              {
                id: 'link-id',
                shortCode: 'abc123',
                userId: 'user-id',
                isActive: updates.isActive ?? true,
                deletedAt: updates.deletedAt ?? null,
                originalUrl: 'https://example.com'
              }
            ])
          )
        }))
      };
    })
  }))
};

mock.module('@urlfy/data', () => ({
  db: mockDb,
  checkDatabaseHealth: mock(() =>
    Promise.resolve({ status: 'ok' as const, latencyMs: 1 })
  )
}));

// ── Cache mock ────────────────────────────────────────────────────────────────

const mockCacheService = {
  invalidateLinkAndQR: mock(() => Promise.resolve())
};

mock.module('@/server/services/cache.service', () => ({
  cacheService: mockCacheService
}));

// ── LinkService stub (used by softDeleteLink internally) ──────────────────────

mock.module('@/server/modules/links/links.service', () => ({
  LinkService: {
    getLinkById: mock(() =>
      Promise.resolve({
        id: 'link-id',
        shortCode: 'abc123',
        userId: 'user-id',
        isActive: true,
        deletedAt: null,
        originalUrl: 'https://example.com'
      })
    )
  }
}));

// ── Subject under test ────────────────────────────────────────────────────────

import { LinkLifecycleService } from '../link-lifecycle.service';

// ── Tests ─────────────────────────────────────────────────────────────────────

afterAll(() => {
  mock.restore();
});

describe('LinkLifecycleService.restoreLink — restore invariant', () => {
  it('sets isActive = true when restoring a deleted link', async () => {
    // Make the initial SELECT return a soft-deleted link
    const deletedAt = new Date('2026-01-01T00:00:00Z');
    mockDb.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve([
              {
                id: 'link-id',
                shortCode: 'abc123',
                userId: 'user-id',
                isActive: false,
                deletedAt,
                originalUrl: 'https://example.com'
              }
            ])
          )
        }))
      }))
    }));

    await LinkLifecycleService.restoreLink('link-id', 'user-id');

    expect(lastUpdateSet.isActive).toBe(true);
    expect(lastUpdateSet.deletedAt).toBeNull();
  });

  it('clears deletedAt when restoring a soft-deleted link', async () => {
    const deletedAt = new Date('2026-01-01T00:00:00Z');
    mockDb.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve([
              {
                id: 'link-id',
                shortCode: 'abc123',
                userId: 'user-id',
                isActive: false,
                deletedAt,
                originalUrl: 'https://example.com'
              }
            ])
          )
        }))
      }))
    }));

    const result = await LinkLifecycleService.restoreLink('link-id', 'user-id');

    // The returned link must have no deletedAt so redirect path treats it as live
    expect(result.deletedAt).toBeNull();
  });

  it('returns immediately without DB write when link is not deleted', async () => {
    mockDb.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve([
              {
                id: 'link-id',
                shortCode: 'abc123',
                userId: 'user-id',
                isActive: true,
                deletedAt: null,
                originalUrl: 'https://example.com'
              }
            ])
          )
        }))
      }))
    }));

    const writesBefore = (mockDb.update as ReturnType<typeof mock>).mock.calls
      .length;
    await LinkLifecycleService.restoreLink('link-id', 'user-id');
    const writesAfter = (mockDb.update as ReturnType<typeof mock>).mock.calls
      .length;

    expect(writesAfter).toBe(writesBefore); // no DB write for already-active link
  });

  it('invalidates cache after successful restore', async () => {
    const callsBefore = (
      mockCacheService.invalidateLinkAndQR as ReturnType<typeof mock>
    ).mock.calls.length;

    mockDb.select.mockImplementation(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve([
              {
                id: 'link-id',
                shortCode: 'abc123',
                userId: 'user-id',
                isActive: false,
                deletedAt: new Date(),
                originalUrl: 'https://example.com'
              }
            ])
          )
        }))
      }))
    }));

    await LinkLifecycleService.restoreLink('link-id', 'user-id');

    const callsAfter = (
      mockCacheService.invalidateLinkAndQR as ReturnType<typeof mock>
    ).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });
});

describe('LinkLifecycleService.softDeleteLink — delete invariant', () => {
  it('sets both deletedAt and isActive = false', async () => {
    await LinkLifecycleService.softDeleteLink('link-id', 'user-id');

    expect(lastUpdateSet.isActive).toBe(false);
    expect(lastUpdateSet.deletedAt).toBeInstanceOf(Date);
  });
});
