/**
 * ═════════════════════════════════════════════════════════════════════
 * INTERNAL CONTROLLER - Internal API routes for middleware communication
 * ═════════════════════════════════════════════════════════════════════
 * Module: Internal
 * Pattern: Elysia instance as controller
 * Security: Requires x-internal-api header matching INTERNAL_API_SECRET
 * ═════════════════════════════════════════════════════════════════════
 */

import { timingSafeEqual } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { jwtPlugin } from '@/server/config/plugins';
import { RATE_LIMIT_CONFIGS, rateLimiter } from '@/server/lib/rate-limiter';
import { MetricsService } from '@/server/services/metrics.service';
import { redirectService } from '@/server/services/redirect.service';
import {
  InternalModel,
  ResolveCodeParam,
  ResolveErrorResponse,
  ResolveRequestBody,
  ResolveSuccessResponse
} from './internal.schema';

/**
 * Verify internal API request
 * Checks x-internal-api header matches INTERNAL_API_SECRET
 */
function verifyInternalRequest(request: Request): boolean {
  const secret = request.headers.get('x-internal-api');
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  // Defensive: Should never happen due to env validation at startup
  if (!expectedSecret) {
    throw new Error('INTERNAL_API_SECRET not configured');
  }
  if (!secret) return false;

  const a = Buffer.from(secret);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Internal Resolution Controller
 * Handles link resolution for Edge proxy
 */
export const internalController = new Elysia({ prefix: '/internal' })
  .use(jwtPlugin)
  .use(InternalModel)

  // ─────────────────────────────────────────────────────────────────
  // POST /internal/resolve/:code - Resolve link for redirect
  // ─────────────────────────────────────────────────────────────────
  .post(
    '/resolve/:code',
    async ({ params, body, request, jwt, set }) => {
      // 1. Verify internal API secret
      if (!verifyInternalRequest(request)) {
        set.status = 401;
        return {
          success: false,
          error: 'UNAUTHORIZED'
        };
      }

      // 2. Track request for RPS metrics (non-blocking)
      MetricsService.trackRequest().catch(() => {
        // Intentionally ignored - metrics should never block requests
      });

      const { code } = params;
      const { depth, ip } = body;

      // 2.1. Extract password token from header
      const passwordToken =
        request.headers.get('x-password-token') ?? undefined;

      // 3. Rate limiting checks
      const redirectConfig = RATE_LIMIT_CONFIGS.GET_REDIRECT;
      if (redirectConfig) {
        const clientIp =
          typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';

        // Rate limit by IP
        if (redirectConfig.perIP) {
          const ipLimit = await rateLimiter.checkIPLimit(
            clientIp,
            redirectConfig.perIP
          );

          if (!ipLimit.allowed) {
            set.status = 429;
            set.headers['Retry-After'] = String(ipLimit.retryAfter ?? 60);
            set.headers['X-RateLimit-Limit'] = String(
              redirectConfig.perIP.points
            );
            set.headers['X-RateLimit-Remaining'] = String(ipLimit.remaining);
            set.headers['X-RateLimit-Reset'] = String(
              Math.floor(ipLimit.resetTime / 1000)
            );

            return {
              success: false,
              error: 'RATE_LIMITED',
              retryAfter: ipLimit.retryAfter
            };
          }
        }

        // Rate limit by link
        if (redirectConfig.perLink) {
          const linkLimit = await rateLimiter.checkLinkLimit(
            code,
            redirectConfig.perLink
          );

          if (!linkLimit.allowed) {
            set.status = 429;
            set.headers['Retry-After'] = String(linkLimit.retryAfter ?? 60);
            set.headers['X-RateLimit-Limit'] = String(
              redirectConfig.perLink.points
            );
            set.headers['X-RateLimit-Remaining'] = String(linkLimit.remaining);
            set.headers['X-RateLimit-Reset'] = String(
              Math.floor(linkLimit.resetTime / 1000)
            );

            return {
              success: false,
              error: 'RATE_LIMITED',
              retryAfter: linkLimit.retryAfter
            };
          }
        }
      }

      // 4. Verify JWT password token if provided
      let bypassPassword = false;
      if (passwordToken) {
        try {
          const payload = await jwt.verify(passwordToken);

          // Validate payload structure and match code
          if (
            payload &&
            typeof payload === 'object' &&
            'code' in payload &&
            'type' in payload &&
            payload.code === code &&
            payload.type === 'unlock'
          ) {
            bypassPassword = true;
          }
        } catch (_error) {
          // Invalid/expired token - don't bypass password
          bypassPassword = false;
        }
      }

      // 5. Resolve link via redirect service
      const result = await redirectService.resolve(
        code,
        depth ?? 0,
        bypassPassword
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'UNKNOWN_ERROR'
        };
      }

      // 6. Return success with redirect info
      // Type assertion: redirectService.resolve guarantees these are defined on success
      set.headers['X-Internal-Cache-Status'] = result.cacheHit ? 'HIT' : 'MISS';

      return {
        success: true,
        url: result.url as string,
        redirectType: result.redirectType as 301 | 302,
        linkId: result.linkId as string
      };
    },
    {
      params: ResolveCodeParam,
      body: ResolveRequestBody,
      detail: {
        tags: ['Internal'],
        summary: 'Resolve link for redirect (Internal)',
        description:
          'Internal API endpoint called by Edge proxy to resolve short codes. Requires internal API secret.',
        security: [{ internalApi: [] }]
      },
      response: {
        200: t.Union([ResolveSuccessResponse, ResolveErrorResponse], {
          description: 'Link resolution result'
        }),
        401: t.Object(
          {
            success: t.Literal(false),
            error: t.Literal('UNAUTHORIZED')
          },
          {
            description: 'Invalid or missing internal API secret'
          }
        ),
        429: ResolveErrorResponse
      }
    }
  );
