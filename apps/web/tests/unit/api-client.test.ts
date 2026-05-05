// tests/unit/api-client.test.ts

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import * as adminApi from '@/lib/api/admin';
import { resolveApiBaseUrl, resolveBaseUrl } from '@/lib/api/client';
import * as api from '@/lib/api/links';
import type { LinkResponse } from '@/types/links.types';

// Mock global fetch
const mockFetch = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve(new Response())
);

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    ...overrides
  } as NodeJS.ProcessEnv;
}

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

describe('API Client - Pagination Handling', () => {
  it('should return paginated response with data and meta', async () => {
    const mockLinks: LinkResponse[] = [
      {
        id: '1',
        shortCode: 'abc123',
        shortUrl: 'https://urlfy.cc/abc123',
        originalUrl: 'https://example.com',
        redirectType: 301,
        clicksCount: 10,
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
    ];

    const mockResponse = {
      success: true,
      data: mockLinks,
      meta: {
        total: 100,
        page: 1,
        perPage: 20,
        lastPage: 5,
        hasMore: true
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLinks({ page: 1, perPage: 20 });

    // Verify the structure matches PaginatedResponse<LinkResponse>
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.data).toBeArray();
    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(100);
    expect(result.meta.page).toBe(1);
    expect(result.meta.hasMore).toBe(true);
  });

  it('should return direct data for non-paginated responses', async () => {
    const mockLink: LinkResponse = {
      id: '1',
      shortCode: 'abc123',
      shortUrl: 'https://urlfy.cc/abc123',
      originalUrl: 'https://example.com',
      redirectType: 301,
      clicksCount: 10,
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
    };

    const mockResponse = {
      success: true,
      data: mockLink
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await api.getLink('1');

    // Verify the structure is the direct LinkResponse
    expect(result).not.toHaveProperty('meta');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('shortCode');
    expect(result.id).toBe('1');
    expect(result.shortCode).toBe('abc123');
  });

  it('should handle empty paginated response', async () => {
    const mockResponse = {
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
        new Response(JSON.stringify(mockResponse), {
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

  it('should throw ApiClientError on API error', async () => {
    const mockResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'url' }
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    expect(api.getLinks()).rejects.toThrow('Invalid input');
  });

  it('should handle 204 No Content responses', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(null, {
          status: 204
        })
      )
    );

    const result = await api.deleteLink('1');

    // Eden Treaty with 204 should return undefined
    expect(result).toBeUndefined();
  });

  it('should include credentials in requests', async () => {
    const mockResponse = {
      success: true,
      data: []
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    await api.getLinks();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include'
      })
    );
  });

  it('should preserve queue degraded metadata from admin queue responses', async () => {
    const mockResponse = {
      success: true,
      degraded: true,
      data: {
        analytics: {
          name: 'analytics',
          length: 10,
          groups: 1,
          pending: 2,
          degraded: true
        }
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await adminApi.getQueueStats();

    expect(result.degraded).toBe(true);
    expect(result.data.analytics.degraded).toBe(true);
    expect(result.data.analytics.length).toBe(10);
  });
});

describe('API Client - Error Handling', () => {
  it('should handle empty response body gracefully', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    // Eden Treaty may throw JSON parse error for empty strings
    // This is expected behavior - empty responses should use 204 instead
    await expect(api.getLinks()).rejects.toThrow();
  });

  it('should handle invalid JSON', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response('invalid json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    // Eden Treaty throws specific JSON parse errors
    await expect(api.getLinks()).rejects.toThrow('JSON Parse error');
  });

  it('should propagate network errors', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.reject(new Error('Network error'))
    );

    // Eden Treaty wraps network errors - we should still get an error thrown
    await expect(api.getLinks()).rejects.toThrow();
  });
});

describe('API Client - Query Parameters', () => {
  it('should build query parameters correctly for getLinks', async () => {
    const mockResponse = {
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        perPage: 10,
        lastPage: 0,
        hasMore: false
      }
    };

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    await api.getLinks({
      page: 2,
      perPage: 10,
      search: 'test',
      isActive: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      tags: ['work', 'personal']
    });

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string | undefined;
    expect(calledUrl).toBeDefined();
    expect(typeof calledUrl).toBe('string');
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('perPage=10');
    expect(calledUrl).toContain('search=test');
    expect(calledUrl).toContain('isActive=true');
    expect(calledUrl).toContain('sortBy=createdAt');
    expect(calledUrl).toContain('sortOrder=desc');
    expect(calledUrl).toContain('tags=work%2Cpersonal');
  });
});

describe('API Client - Base URL Resolution', () => {
  it('prefers the browser origin for same-origin client requests', () => {
    expect(
      resolveBaseUrl(
        createEnv({ NEXT_PUBLIC_APP_URL: 'https://urlfy.cc' }),
        'https://browser.urlfy.cc'
      )
    ).toBe('https://browser.urlfy.cc');

    expect(
      resolveApiBaseUrl(
        createEnv({
          API_INTERNAL_URL: 'http://api:3001',
          NEXT_PUBLIC_APP_URL: 'https://urlfy.cc'
        }),
        'https://browser.urlfy.cc'
      )
    ).toBe('https://browser.urlfy.cc');
  });

  it('keeps the public origin and API transport origin distinct on the server', () => {
    const env = createEnv({
      API_INTERNAL_URL: 'http://api:3001',
      NEXT_PUBLIC_APP_URL: 'https://urlfy.cc'
    });

    expect(resolveBaseUrl(env, '')).toBe('https://urlfy.cc');
    expect(resolveApiBaseUrl(env, '')).toBe('http://api:3001');
  });

  it('falls back to localhost defaults when env is absent', () => {
    expect(resolveBaseUrl(createEnv(), '')).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl(createEnv(), '')).toBe('http://localhost:3001');
  });
});
