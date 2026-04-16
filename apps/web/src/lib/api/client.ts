// src/lib/api/client.ts
/**
 * Eden Client Initialization
 * Type-safe API client using Elysia Eden Treaty
 */

import { treaty } from '@elysiajs/eden';
import type { ApiClientContract } from './api-types';

// ═══════════════════════════════════════════════════════════════════
// BASE URL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

function getBrowserOrigin(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined;
}

/** Public app origin used for user-facing URLs. */
export function resolveBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  browserOrigin: string | undefined = getBrowserOrigin()
): string {
  return browserOrigin || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Transport base for API requests.
 * Browser calls stay same-origin, while server-side calls use the internal API
 * origin to avoid hairpinning through the public ingress.
 */
export function resolveApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  browserOrigin: string | undefined = getBrowserOrigin()
): string {
  return (
    browserOrigin ||
    env.API_INTERNAL_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3001'
  );
}

export const BASE_URL = resolveBaseUrl();
export const API_BASE_URL = resolveApiBaseUrl();

// ═══════════════════════════════════════════════════════════════════
// CLIENT INSTANCES
// ═══════════════════════════════════════════════════════════════════

/**
 * Default Eden Treaty client with credentials.
 *
 * The runtime still comes from Eden Treaty, but the namespace contract lives in
 * @urlfy/contracts so apps/web stays decoupled from apps/api internals.
 */
export const client = treaty(API_BASE_URL, {
  fetch: {
    credentials: 'include' // Required for cookies to be sent
  }
}) as unknown as ApiClientContract;

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
  return treaty(API_BASE_URL, {
    fetch: {
      credentials: 'include'
    },
    headers
  }) as unknown as ApiClientContract;
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

export type { ApiClientContract };
