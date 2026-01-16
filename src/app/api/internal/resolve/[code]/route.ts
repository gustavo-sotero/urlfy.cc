// src/app/api/internal/resolve/[code]/route.ts
/**
 * Internal API for link resolution
 * Called by Edge middleware to resolve links using full Node.js runtime
 */

import { type NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT_CONFIGS, rateLimiter } from '@/server/lib/rate-limiter';
import { redirectService } from '@/server/services/redirect.service';

// Verify internal API secret
function verifyInternalRequest(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-api');
  const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-secret';
  return secret === expectedSecret;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Verify this is an internal request
    if (!verifyInternalRequest(request)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { code } = await params;
    const body = await request.json();
    const { depth, hasPasswordCookie, ip } = body as {
      depth?: number;
      hasPasswordCookie?: boolean;
      ip?: string;
    };

    const redirectConfig = RATE_LIMIT_CONFIGS.GET_REDIRECT;
    if (redirectConfig) {
      const clientIp = typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';

      if (redirectConfig.perIP) {
        const ipLimit = await rateLimiter.checkIPLimit(
          clientIp,
          redirectConfig.perIP
        );

        if (!ipLimit.allowed) {
          return NextResponse.json(
            {
              success: false,
              error: 'RATE_LIMITED',
              retryAfter: ipLimit.retryAfter
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(ipLimit.retryAfter ?? 60),
                'X-RateLimit-Limit': String(redirectConfig.perIP.points),
                'X-RateLimit-Remaining': String(ipLimit.remaining),
                'X-RateLimit-Reset': String(
                  Math.floor(ipLimit.resetTime / 1000)
                )
              }
            }
          );
        }
      }

      if (redirectConfig.perLink) {
        const linkLimit = await rateLimiter.checkLinkLimit(
          code,
          redirectConfig.perLink
        );

        if (!linkLimit.allowed) {
          return NextResponse.json(
            {
              success: false,
              error: 'RATE_LIMITED',
              retryAfter: linkLimit.retryAfter
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(linkLimit.retryAfter ?? 60),
                'X-RateLimit-Limit': String(redirectConfig.perLink.points),
                'X-RateLimit-Remaining': String(linkLimit.remaining),
                'X-RateLimit-Reset': String(
                  Math.floor(linkLimit.resetTime / 1000)
                )
              }
            }
          );
        }
      }
    }

    // Use the existing redirect service
    const result = await redirectService.resolve(
      code,
      depth ?? 0,
      hasPasswordCookie ?? false
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'UNKNOWN_ERROR'
        },
        { status: 200 }
      );
    }

    // Return success with redirect info
    return NextResponse.json({
      success: true,
      url: result.url,
      redirectType: result.redirectType,
      linkId: result.linkId
    });
  } catch (error) {
    console.error('Internal resolve error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
