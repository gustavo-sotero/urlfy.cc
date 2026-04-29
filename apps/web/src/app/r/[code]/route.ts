/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT ROUTE HANDLER - Direct redirect without HTTP hop
 * ═════════════════════════════════════════════════════════════════════
 * Handles GET /:code redirects by resolving the short code directly
 * in the Node.js runtime. This eliminates the previous internal HTTP
 * hop (Edge → fetch → Elysia internal API → redirect) and replaces
 * it with a single pass (Edge rewrite → Node.js route → redirect).
 *
 * ═════════════════════════════════════════════════════════════════════
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  drainPendingClicks,
  incrementPendingClicks,
  RedisStream,
  STREAM_NAMES
} from '@urlfy/cache';
import { REDIRECT_RATE_LIMIT_CONFIG } from '@urlfy/contracts';
import { createLogger, fireAndForget } from '@urlfy/telemetry';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/server/lib/ip';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { MetricsService } from '@/server/services/metrics.service';
import { redirectService } from '@/server/services/redirect-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('redirect-handler');

/** Public app base URL for user-facing redirects */
function getPublicBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://urlfy.cc';
}

/**
 * Verify a password unlock JWT token using HMAC-SHA256.
 * Compatible with @elysiajs/jwt default algorithm.
 */
function verifyUnlockToken(token: string, code: string): boolean {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return false;

  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    // Verify signature (HS256)
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    const sigBuffer = Buffer.from(signatureB64, 'base64url');
    const expectedBuffer = Buffer.from(expectedSig, 'base64url');

    if (sigBuffer.length !== expectedBuffer.length) return false;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return false;

    // Decode and validate payload
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString()
    ) as { code?: string; type?: string; exp?: number };

    // Require expiration claim — tokens without exp are invalid
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    // Check code and type match
    return payload.code === code && payload.type === 'unlock';
  } catch {
    return false;
  }
}

/**
 * Build error redirect/response matching the existing error-handler semantics
 */
function handleError(
  error: string,
  code: string,
  requestId: string,
  retryAfter?: number
): NextResponse {
  const baseUrl = getPublicBaseUrl();

  switch (error) {
    case 'NOT_FOUND':
      return NextResponse.redirect(`${baseUrl}/404`, {
        status: 302,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'NOT_FOUND'
        }
      });

    case 'PASSWORD_REQUIRED':
      return NextResponse.redirect(`${baseUrl}/unlock/${code}`, {
        status: 302,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'PASSWORD_REQUIRED'
        }
      });

    case 'RATE_LIMITED': {
      const headers: Record<string, string> = {
        'X-Request-Id': requestId,
        'X-Error-Code': 'RATE_LIMITED',
        'Content-Type': 'text/plain'
      };
      if (retryAfter) headers['Retry-After'] = String(retryAfter);
      return new NextResponse(null, { status: 429, headers });
    }

    case 'REDIRECT_LOOP':
      return new NextResponse(null, {
        status: 421,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'REDIRECT_LOOP',
          'Content-Type': 'text/plain'
        }
      });

    case 'EXPIRED':
    case 'INACTIVE':
    case 'MAX_CLICKS':
      return new NextResponse(null, {
        status: 410,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': error,
          'Content-Type': 'text/plain'
        }
      });

    case 'BANNED':
      return new NextResponse(null, {
        status: 451,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_BANNED',
          'Content-Type': 'text/plain'
        }
      });

    default:
      return new NextResponse(null, {
        status: 500,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'INTERNAL_ERROR',
          'Content-Type': 'text/plain'
        }
      });
  }
}

/**
 * Reserve one pending click before returning when MAX_CLICKS enforcement
 * needs recent redirects to be visible to the next resolver call.
 */
async function reservePendingClick(
  linkId: string,
  code: string
): Promise<boolean> {
  const nextPendingCount = await incrementPendingClicks(linkId);

  if (nextPendingCount === null) {
    logger.warn('Failed to reserve pending click before redirect response', {
      shortCode: code,
      linkId
    });
    return false;
  }

  return true;
}

/**
 * Dispatch click analytics event to Redis stream (non-blocking).
 * The pending-click delta is reserved before this function is called and
 * reverted here only if the stream enqueue fails.
 */
function dispatchAnalytics(
  request: NextRequest,
  code: string,
  linkId: string,
  pendingClickReserved: boolean
): void {
  const searchParams = request.nextUrl.searchParams;

  fireAndForget(
    'analytics-emit',
    async () => {
      try {
        await RedisStream.add(STREAM_NAMES.analyticsClicks, {
          linkId,
          shortCode: code,
          ip: getClientIp(request),
          userAgent: request.headers.get('user-agent') ?? '',
          referer: request.headers.get('referer') ?? '',
          utmSource: searchParams.get('utm_source') ?? '',
          utmMedium: searchParams.get('utm_medium') ?? '',
          utmCampaign: searchParams.get('utm_campaign') ?? '',
          utmContent: searchParams.get('utm_content') ?? '',
          utmTerm: searchParams.get('utm_term') ?? '',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        if (pendingClickReserved) {
          await drainPendingClicks(linkId);
        }
        throw error;
      }
    },
    { shortCode: code, linkId }
  );
}

/**
 * GET /r/:code — Redirect handler
 *
 * Formerly resolved via internal HTTP fetch; now runs directly in
 * Node.js runtime, eliminating one network hop from the hot path.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const startTime = performance.now();
  const { code } = await params;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const clientIp = getClientIp(request);

  try {
    // ── 1. Rate limiting (IP + per-link) ─────────────────────────
    const redirectConfig = REDIRECT_RATE_LIMIT_CONFIG;
    if (redirectConfig) {
      // Run both checks in parallel — they are independent Redis operations
      const [ipLimit, linkLimit] = await Promise.all([
        redirectConfig.perIP
          ? rateLimiter.checkIPLimit(clientIp, redirectConfig.perIP)
          : Promise.resolve({ allowed: true as const }),
        redirectConfig.perLink
          ? rateLimiter.checkLinkLimit(code, redirectConfig.perLink)
          : Promise.resolve({ allowed: true as const })
      ]);

      // IP limit takes priority to avoid leaking per-link traffic data
      if (!ipLimit.allowed) {
        return handleError(
          'RATE_LIMITED',
          code,
          requestId,
          (ipLimit as { allowed: false; retryAfter?: number }).retryAfter
        );
      }
      if (!linkLimit.allowed) {
        return handleError(
          'RATE_LIMITED',
          code,
          requestId,
          (linkLimit as { allowed: false; retryAfter?: number }).retryAfter
        );
      }
    }

    // ── 2. Password token verification ───────────────────────────
    let bypassPassword = false;
    const cookieStore = await cookies();
    const passwordToken = cookieStore.get(`urlfy_unlock_${code}`)?.value;

    if (passwordToken) {
      bypassPassword = verifyUnlockToken(passwordToken, code);
    }

    // ── 3. Track RPS metrics (non-blocking) ──────────────────────
    fireAndForget('rps-metrics', () => MetricsService.trackRequest(), {
      shortCode: code
    });

    // ── 4. Resolve link (cache-first → DB fallback) ──────────────
    const result = await redirectService.resolve({
      linkCode: code,
      currentDepth: 0,
      bypassPassword,
      requestMeta: {
        ip: clientIp,
        userAgent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer'),
        requestId
      }
    });

    if (!result.success) {
      return handleError(result.error || 'UNKNOWN_ERROR', code, requestId);
    }

    // ── 5. Reserve click when needed + dispatch analytics ────────
    // Only max-click-limited links need a synchronous pending delta for
    // correctness. Other links keep the hot path lean and let the worker update
    // counters from the analytics stream.
    if (result.linkId) {
      let pendingClickReserved = false;

      if (result.requiresClickReservation) {
        pendingClickReserved = await reservePendingClick(result.linkId, code);

        if (!pendingClickReserved) {
          return handleError('INTERNAL_ERROR', code, requestId);
        }
      }

      dispatchAnalytics(request, code, result.linkId, pendingClickReserved);
    }

    // ── 6. Return redirect ───────────────────────────────────────
    const redirectUrl = result.url ?? `${getPublicBaseUrl()}/`;
    const redirectType = (result.redirectType as 301 | 302) ?? 302;

    return NextResponse.redirect(redirectUrl, {
      status: redirectType,
      headers: {
        'X-Request-Id': requestId,
        'X-Cache-Status': result.cacheHit ? 'HIT' : 'MISS',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    const latency = performance.now() - startTime;
    logger.error('Redirect error', {
      shortCode: code,
      requestId,
      latencyMs: latency.toFixed(2),
      error: error instanceof Error ? error.message : String(error)
    });

    return handleError('INTERNAL_ERROR', code, requestId);
  }
}
