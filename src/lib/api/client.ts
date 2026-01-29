// src/lib/api/client.ts
/**
 * Eden Client Initialization
 * Type-safe API client using Elysia Eden Treaty
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@/server';

// ═══════════════════════════════════════════════════════════════════
// BASE URL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/** Base URL for API requests */
export const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════
// CLIENT INSTANCES
// ═══════════════════════════════════════════════════════════════════

/** Default Eden Treaty client with credentials */
export const client = treaty<App>(BASE_URL, {
  fetch: {
    credentials: 'include' // Required for cookies to be sent
  }
});

/**
 * Export default client instance for use in components
 */
export const apiClient = {
  get: async (url: string) => {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    return response.json();
  },
  post: async (url: string, data?: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }
};

/**
 * Create a client instance with custom headers (e.g., for SSR with cookies)
 * Use this when calling from Next.js server components to forward authentication
 *
 * @example
 * ```tsx
 * // In a Next.js server component
 * import { headers } from 'next/headers';
 *
 * async function MyServerComponent() {
 *   const requestHeaders = await headers();
 *   const headersObj = Object.fromEntries(requestHeaders.entries());
 *   const client = createClientWithHeaders(headersObj);
 *   // Use client...
 * }
 * ```
 */
export function createClientWithHeaders(headers: HeadersInit) {
  return treaty<App>(BASE_URL, {
    fetch: {
      credentials: 'include'
    },
    headers
  });
}

/**
 * Helper to convert Next.js Headers to plain object for API client
 * @example
 * ```tsx
 * import { headers } from 'next/headers';
 *
 * const requestHeaders = await headers();
 * const headersObj = convertHeadersForApiClient(requestHeaders);
 * ```
 */
export function convertHeadersForApiClient(
  headers: Headers
): Record<string, string> {
  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  return headersObj;
}

export type { App };
