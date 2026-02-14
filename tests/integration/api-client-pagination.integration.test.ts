// tests/integration/api-client-pagination.integration.test.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * API CLIENT PAGINATION - INTEGRATION TEST
 * ═════════════════════════════════════════════════════════════════════
 * Validates that the api-client correctly handles paginated responses
 * from the backend and properly maps them to the expected structure.
 * ═════════════════════════════════════════════════════════════════════
 */

import * as api from '@/lib/api';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock fetch at the global level
const mockFetch = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve(new Response())
);
beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

describe('API Client - Paginated Response Integration', () => {
  it('should correctly parse backend paginated response structure', async () => {
    // Simulate actual backend response structure from links.controller.ts
    const backendResponse = {
      success: true,
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          shortCode: 'abc123',
          shortUrl: 'https://urlfy.cc/abc123',
          originalUrl: 'https://example.com/page1',
          redirectType: 301,
          clicksCount: 42,
          maxClicks: null,
          isActive: true,
          isBanned: false,
          bannedReason: null,
          isProtected: false,
          expiresAt: null,
          metaTitle: 'Test Page 1',
          metaDescription: 'Description 1',
          metaImage: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          tags: ['work', 'important'],
          notes: 'Test note',
          lastClickedAt: '2026-01-15T10:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z'
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          shortCode: 'xyz789',
          shortUrl: 'https://urlfy.cc/xyz789',
          originalUrl: 'https://example.com/page2',
          redirectType: 302,
          clicksCount: 10,
          maxClicks: 100,
          isActive: true,
          isBanned: false,
          bannedReason: null,
          isProtected: true,
          expiresAt: '2026-06-01T00:00:00Z',
          metaTitle: null,
          metaDescription: null,
          metaImage: null,
          utmSource: 'twitter',
          utmMedium: 'social',
          utmCampaign: 'launch',
          tags: null,
          notes: null,
          lastClickedAt: null,
          createdAt: '2026-01-10T00:00:00Z',
          updatedAt: '2026-01-10T00:00:00Z'
        }
      ],
      meta: {
        total: 50,
        page: 1,
        perPage: 20,
        lastPage: 3,
        hasMore: true
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    // Call the API client method
    const result = await api.getLinks({ page: 1, perPage: 20 });

    // Verify structure matches PaginatedResponse<LinkResponse>
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');

    // Verify data array
    expect(result.data).toBeArray();
    expect(result.data.length).toBe(2);

    // Verify first link
    const firstLink = result.data[0];
    expect(firstLink.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(firstLink.shortCode).toBe('abc123');
    expect(firstLink.originalUrl).toBe('https://example.com/page1');
    expect(firstLink.clicksCount).toBe(42);
    expect(firstLink.tags).toEqual(['work', 'important']);

    // Verify second link
    const secondLink = result.data[1];
    expect(secondLink.id).toBe('660e8400-e29b-41d4-a716-446655440001');
    expect(secondLink.isProtected).toBe(true);
    expect(secondLink.utmSource).toBe('twitter');

    // Verify pagination metadata
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(1);
    expect(result.meta.perPage).toBe(20);
    expect(result.meta.lastPage).toBe(3);
    expect(result.meta.hasMore).toBe(true);
  });

  it('should handle empty paginated response correctly', async () => {
    const backendResponse = {
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        perPage: 20,
        lastPage: 0,
        hasMore: false
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLinks();

    expect(result.data).toBeArray();
    expect(result.data.length).toBe(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.hasMore).toBe(false);
  });

  it('should handle last page correctly (hasMore: false)', async () => {
    const backendResponse = {
      success: true,
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          shortCode: 'last123',
          shortUrl: 'https://urlfy.cc/last123',
          originalUrl: 'https://example.com/last',
          redirectType: 301,
          clicksCount: 5,
          maxClicks: null,
          isActive: true,
          isBanned: false,
          bannedReason: null,
          isProtected: false,
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
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ],
      meta: {
        total: 21,
        page: 2,
        perPage: 20,
        lastPage: 2,
        hasMore: false
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLinks({ page: 2, perPage: 20 });

    expect(result.data.length).toBe(1);
    expect(result.meta.page).toBe(2);
    expect(result.meta.lastPage).toBe(2);
    expect(result.meta.hasMore).toBe(false);
  });

  it('should allow consumers to access data array and meta independently', async () => {
    const backendResponse = {
      success: true,
      data: [
        {
          id: '1',
          shortCode: 'test',
          shortUrl: 'https://urlfy.cc/test',
          originalUrl: 'https://example.com',
          redirectType: 301,
          clicksCount: 0,
          maxClicks: null,
          isActive: true,
          isBanned: false,
          bannedReason: null,
          isProtected: false,
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
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ],
      meta: {
        total: 10,
        page: 1,
        perPage: 1,
        lastPage: 10,
        hasMore: true
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLinks({ page: 1, perPage: 1 });

    // This simulates how components use the response
    const linksArray = result.data;
    const paginationInfo = result.meta;

    // Components should be able to:
    // 1. Map over the data array
    expect(linksArray.map((link) => link.shortCode)).toEqual(['test']);

    // 2. Access pagination for UI rendering
    expect(paginationInfo.total).toBe(10);
    expect(paginationInfo.hasMore).toBe(true);

    // 3. Conditionally show pagination controls
    if (paginationInfo.lastPage > 1) {
      expect(true).toBe(true); // Pagination should be shown
    }
  });
});

describe('API Client - Non-Paginated Response Integration', () => {
  it('should NOT add meta to single resource responses', async () => {
    const backendResponse = {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortCode: 'abc123',
        shortUrl: 'https://urlfy.cc/abc123',
        originalUrl: 'https://example.com',
        redirectType: 301,
        clicksCount: 42,
        maxClicks: null,
        isActive: true,
        isBanned: false,
        bannedReason: null,
        isProtected: false,
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
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLink('550e8400-e29b-41d4-a716-446655440000');

    // Should be a direct LinkResponse object, not wrapped
    expect(result).not.toHaveProperty('meta');
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.shortCode).toBe('abc123');
  });

  it('should handle create link response (non-paginated)', async () => {
    const backendResponse = {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortCode: 'new123',
        shortUrl: 'https://urlfy.cc/new123',
        originalUrl: 'https://example.com/new',
        redirectType: 301,
        clicksCount: 0,
        maxClicks: null,
        isActive: true,
        isBanned: false,
        bannedReason: null,
        isProtected: false,
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
        createdAt: '2026-01-16T00:00:00Z',
        updatedAt: '2026-01-16T00:00:00Z'
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(backendResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.createLink({
      url: 'https://example.com/new'
    });

    expect(result).not.toHaveProperty('meta');
    expect(result.shortCode).toBe('new123');
    expect(result.originalUrl).toBe('https://example.com/new');
  });
});
