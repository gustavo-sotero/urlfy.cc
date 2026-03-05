/**
 * ═════════════════════════════════════════════════════════════════════
 * SESSION UTILITIES
 * ═════════════════════════════════════════════════════════════════════
 *
 * Utilities for session management and cache invalidation
 *
 * Module: Authentication & Identity (Module 2)
 * ═════════════════════════════════════════════════════════════════════
 */

import { cookies } from 'next/headers';

/**
 * Forces a session revalidation by clearing the cookie cache
 * Useful after critical security changes like enabling 2FA
 */
export async function invalidateSessionCache(): Promise<void> {
  try {
    const cookieStore = await cookies();

    // Clear Better-Auth session cookies to force revalidation
    const sessionCookies = [
      'urlfy.session_token',
      'urlfy.session',
      'better_auth.session_token'
    ];

    for (const cookieName of sessionCookies) {
      if (cookieStore.has(cookieName)) {
        cookieStore.delete(cookieName);
      }
    }
  } catch (_error) {
    // Non-critical — cookie cleanup failure doesn't affect auth
  }
}

/**
 * Adds cache-busting headers to force fresh session checks
 */
export function getSessionHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  };
}
