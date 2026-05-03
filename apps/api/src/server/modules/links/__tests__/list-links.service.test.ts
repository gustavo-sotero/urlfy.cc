process.env.NEXT_PUBLIC_APP_URL = 'https://urlfy.cc';

import { afterAll, describe, expect, it, mock } from 'bun:test';

const liveLink = {
  id: 'live-link',
  userId: 'user-1',
  originalUrl: 'https://example.com/live',
  shortCode: 'live123',
  redirectType: 302,
  clicksCount: 4,
  maxClicks: null,
  passwordHash: null,
  isActive: true,
  isBanned: false,
  bannedAt: null,
  bannedReason: null,
  expiresAt: null,
  metaTitle: null,
  metaDescription: null,
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  lastClickedAt: null,
  qrGeneratedAt: null,
  createdByIpHash: null,
  tags: null,
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null
};

const deletedLink = {
  ...liveLink,
  id: 'deleted-link',
  shortCode: 'gone123',
  originalUrl: 'https://example.com/deleted',
  isActive: false,
  deletedAt: new Date('2026-01-02T00:00:00Z')
};

let selectCount = 0;

const mockDb = {
  select: mock(() => {
    selectCount += 1;

    if (selectCount % 2 === 1) {
      return {
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: mock(() => ({
                offset: mock(() =>
                  Promise.resolve(
                    selectCount === 1 ? [liveLink] : [deletedLink]
                  )
                )
              }))
            }))
          }))
        }))
      };
    }

    return {
      from: mock(() => ({
        where: mock(() => Promise.resolve([{ count: 1 }]))
      }))
    };
  })
};

mock.module('@urlfy/data', () => ({
  db: mockDb
}));

mock.module('@/server/services/realtime-clicks.service', () => ({
  applyPendingClicksToEntities: mock(async <T>(items: T[]) => items)
}));

const { listUserLinks } = await import('../services/list-links');

afterAll(() => {
  mock.restore();
});

describe('listUserLinks', () => {
  it('lists live links by default', async () => {
    selectCount = 0;

    const result = await listUserLinks('user-1', { perPage: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('live-link');
    expect(result.data[0]?.shortUrl).toBe('https://urlfy.cc/live123');
  });

  it('lists deleted links when deleted=true', async () => {
    selectCount = 2;

    const result = await listUserLinks('user-1', {
      deleted: true,
      perPage: 20
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('deleted-link');
    expect(result.data[0]?.shortUrl).toBe('https://urlfy.cc/gone123');
  });
});
