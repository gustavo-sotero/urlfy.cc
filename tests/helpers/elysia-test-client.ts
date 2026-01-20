/**
 * ═════════════════════════════════════════════════════════════════════
 * ELYSIA TEST CLIENT
 * ═════════════════════════════════════════════════════════════════════
 * Test utilities for handler-level testing using Elysia's app.handle()
 *
 * This module follows Elysia best practices by testing endpoints directly
 * through the handler without HTTP overhead, providing fast and reliable
 * integration tests.
 *
 * Usage:
 *   const client = createElysiaTestClient(api);
 *   const response = await client.get('/api/health');
 *   expect(response.status).toBe(200);
 * ═════════════════════════════════════════════════════════════════════
 */

import { expect } from 'bun:test';
import type { AnyElysia } from 'elysia';

export interface TestResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  raw: Response;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface RequestWithBodyOptions extends RequestOptions {
  body?: unknown;
}

/**
 * Creates a test client for an Elysia app instance.
 * Uses app.handle() for direct handler testing without HTTP overhead.
 */
export function createElysiaTestClient(app: AnyElysia) {
  const baseUrl = 'http://localhost:3000';

  /**
   * Build URL with query parameters
   */
  function buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(path, baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  /**
   * Build headers with defaults
   */
  function buildHeaders(
    customHeaders?: Record<string, string>,
    contentType?: string
  ): Headers {
    const headers = new Headers({
      Accept: 'application/json',
      ...customHeaders
    });
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    return headers;
  }

  /**
   * Parse response body based on content type
   */
  async function parseBody<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
      try {
        return (await response.json()) as T;
      } catch {
        return {} as T;
      }
    }

    if (contentType.includes('text/')) {
      return (await response.text()) as T;
    }

    // For binary content (images, etc.)
    return (await response.arrayBuffer()) as T;
  }

  /**
   * Execute a request and return parsed response
   */
  async function executeRequest<T = unknown>(
    method: string,
    path: string,
    options?: RequestWithBodyOptions
  ): Promise<TestResponse<T>> {
    const url = buildUrl(path, options?.query);
    const hasBody = options?.body !== undefined;
    const contentType = hasBody ? 'application/json' : undefined;
    const headers = buildHeaders(options?.headers, contentType);

    const request = new Request(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined
    });

    const response = await app.handle(request);
    const body = await parseBody<T>(response);

    return {
      status: response.status,
      headers: response.headers,
      body,
      raw: response
    };
  }

  return {
    /**
     * Send GET request
     */
    async get<T = unknown>(
      path: string,
      options?: RequestOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>('GET', path, options);
    },

    /**
     * Send POST request
     */
    async post<T = unknown>(
      path: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>('POST', path, { ...options, body });
    },

    /**
     * Send PATCH request
     */
    async patch<T = unknown>(
      path: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>('PATCH', path, { ...options, body });
    },

    /**
     * Send PUT request
     */
    async put<T = unknown>(
      path: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>('PUT', path, { ...options, body });
    },

    /**
     * Send DELETE request
     */
    async delete<T = unknown>(
      path: string,
      options?: RequestOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>('DELETE', path, options);
    },

    /**
     * Send request with custom method
     */
    async request<T = unknown>(
      method: string,
      path: string,
      options?: RequestWithBodyOptions
    ): Promise<TestResponse<T>> {
      return executeRequest<T>(method, path, options);
    },

    /**
     * Helper to add authorization header
     */
    withAuth(token: string) {
      return {
        get: <T = unknown>(path: string, options?: RequestOptions) =>
          executeRequest<T>('GET', path, {
            ...options,
            headers: { ...options?.headers, Authorization: `Bearer ${token}` }
          }),
        post: <T = unknown>(
          path: string,
          body?: unknown,
          options?: RequestOptions
        ) =>
          executeRequest<T>('POST', path, {
            ...options,
            body,
            headers: { ...options?.headers, Authorization: `Bearer ${token}` }
          }),
        patch: <T = unknown>(
          path: string,
          body?: unknown,
          options?: RequestOptions
        ) =>
          executeRequest<T>('PATCH', path, {
            ...options,
            body,
            headers: { ...options?.headers, Authorization: `Bearer ${token}` }
          }),
        delete: <T = unknown>(path: string, options?: RequestOptions) =>
          executeRequest<T>('DELETE', path, {
            ...options,
            headers: { ...options?.headers, Authorization: `Bearer ${token}` }
          })
      };
    },

    /**
     * Helper to add API key header
     */
    withApiKey(apiKey: string) {
      return {
        get: <T = unknown>(path: string, options?: RequestOptions) =>
          executeRequest<T>('GET', path, {
            ...options,
            headers: { ...options?.headers, 'x-api-key': apiKey }
          }),
        post: <T = unknown>(
          path: string,
          body?: unknown,
          options?: RequestOptions
        ) =>
          executeRequest<T>('POST', path, {
            ...options,
            body,
            headers: { ...options?.headers, 'x-api-key': apiKey }
          }),
        patch: <T = unknown>(
          path: string,
          body?: unknown,
          options?: RequestOptions
        ) =>
          executeRequest<T>('PATCH', path, {
            ...options,
            body,
            headers: { ...options?.headers, 'x-api-key': apiKey }
          }),
        delete: <T = unknown>(path: string, options?: RequestOptions) =>
          executeRequest<T>('DELETE', path, {
            ...options,
            headers: { ...options?.headers, 'x-api-key': apiKey }
          })
      };
    }
  };
}

/**
 * Type for the test client
 */
export type ElysiaTestClient = ReturnType<typeof createElysiaTestClient>;

/**
 * Common response type assertions
 */
export const expectSuccess = <T>(
  response: TestResponse<{ success: boolean; data: T }>
) => {
  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();
  return response.body.data;
};

export const expectError = (
  response: TestResponse<{
    success: boolean;
    error: { code: string; message: string };
  }>,
  expectedCode?: string
) => {
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
  if (expectedCode) {
    expect(response.body.error.code).toBe(expectedCode);
  }
  return response.body.error;
};

/**
 * Common HTTP status assertions
 */
export const expectStatus = (
  response: TestResponse,
  expectedStatus: number
) => {
  expect(response.status).toBe(expectedStatus);
};

export const expectOk = (response: TestResponse) => expectStatus(response, 200);
export const expectCreated = (response: TestResponse) =>
  expectStatus(response, 201);
export const expectNoContent = (response: TestResponse) =>
  expectStatus(response, 204);
export const expectBadRequest = (response: TestResponse) =>
  expectStatus(response, 400);
export const expectUnauthorized = (response: TestResponse) =>
  expectStatus(response, 401);
export const expectForbidden = (response: TestResponse) =>
  expectStatus(response, 403);
export const expectNotFound = (response: TestResponse) =>
  expectStatus(response, 404);
export const expectTooManyRequests = (response: TestResponse) =>
  expectStatus(response, 429);
