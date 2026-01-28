// src/server/middleware/redirect/validator.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT VALIDATOR
 * ═════════════════════════════════════════════════════════════════════
 * Request validation logic for redirect middleware
 */

import type { NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/server/config/cors';
import { getClientIp } from '@/server/lib/ip';
import type { ValidationResult } from './types';

/** Maximum redirect depth to prevent loops */
const MAX_REDIRECT_DEPTH = 3;

/**
 * Check if the request host is in the allowed origins list
 */
function isHostAllowed(host: string | null): boolean {
  if (!host) return false;

  const normalizedHost = host.trim().toLowerCase();
  const allowedOrigins = getAllowedOrigins();

  // Extract hosts from allowed origins
  const allowedHosts = new Set(
    allowedOrigins
      .map((origin) => {
        try {
          return new URL(origin).host.toLowerCase();
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value))
  );

  // Also check without port
  const hostWithoutPort = normalizedHost.split(':')[0] || normalizedHost;
  const allowedHostnames = new Set(
    Array.from(allowedHosts).map((allowed) => allowed.split(':')[0] || allowed)
  );

  return (
    allowedHosts.has(normalizedHost) || allowedHostnames.has(hostWithoutPort)
  );
}

/**
 * Get password token from cookie if present
 * Simply retrieves the cookie value without verification
 * JWT verification happens in the internal API
 */
function getPasswordToken(
  request: NextRequest,
  code: string
): string | undefined {
  try {
    const cookieName = `urlfy_unlock_${code}`;
    return request.cookies.get(cookieName)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Validate an incoming redirect request
 *
 * Checks:
 * 1. Host header against allowed origins (production only)
 * 2. Redirect depth to prevent loops
 * 3. Extracts necessary context for resolution
 *
 * @param request - Incoming Next.js request
 * @param code - Short code being resolved
 * @returns Validation result with context or error
 */
export function validateRedirectRequest(
  request: NextRequest,
  code: string
): ValidationResult {
  const requestId = crypto.randomUUID();

  // 1. Host validation (production only)
  if (process.env.NODE_ENV === 'production') {
    const host = request.headers.get('host');
    if (!isHostAllowed(host)) {
      return {
        valid: false,
        error: 'INVALID_HOST',
        status: 400
      };
    }
  }

  // 2. Redirect depth validation
  const depthHeader = request.headers.get('x-redirect-depth');
  const depth = depthHeader ? Number.parseInt(depthHeader, 10) : 0;

  if (depth >= MAX_REDIRECT_DEPTH) {
    return {
      valid: false,
      error: 'REDIRECT_LOOP',
      status: 421
    };
  }

  // 3. Extract context
  return {
    valid: true,
    context: {
      code,
      depth,
      clientIp: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      requestId,
      passwordToken: getPasswordToken(request, code)
    }
  };
}

export { getPasswordToken, isHostAllowed };
