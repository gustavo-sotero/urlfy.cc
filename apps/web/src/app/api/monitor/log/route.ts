/**
 * Client Error Monitoring API
 * Receives and logs client-side errors for debugging
 */

import { createLogger } from '@urlfy/telemetry';
import { type NextRequest, NextResponse } from 'next/server';

const logger = createLogger('client-error-monitor');

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER (in-memory, per-IP, 10 req/min)
// ═══════════════════════════════════════════════════════════════════

const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000;
const MAX_BODY_SIZE = 10 * 1024; // 10 KB

const rateLimitMap = new Map<string, number[]>();

// Periodically clean old entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, WINDOW_MS);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Truncate a string to a max length */
function truncate(value: string | undefined, max: number): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max) : value;
}

/** Strip query parameters from a URL to prevent token leakage */
function stripQueryParams(url: string): string {
  const qIndex = url.indexOf('?');
  return qIndex === -1 ? url : url.slice(0, qIndex);
}

/** Remove control characters that could forge log entries */
function sanitizeForLog(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional for log injection prevention
  return value.replace(/[\x00-\x1f\x7f]/g, ' ');
}

interface ClientError {
  error: string;
  componentStack?: string;
  url: string;
  userAgent?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Body size check
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Body too large' }
        },
        { status: 413 }
      );
    }

    // Rate limiting by IP
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many error reports' }
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as ClientError;

    // Validate required fields
    if (!body.error || !body.url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: error, url'
          }
        },
        { status: 400 }
      );
    }

    // Sanitize and truncate inputs
    const sanitizedError = sanitizeForLog(truncate(body.error, 500));
    const sanitizedStack = sanitizeForLog(truncate(body.componentStack, 2000));
    const sanitizedUrl = sanitizeForLog(
      stripQueryParams(truncate(body.url, 500))
    );

    // Extract client information
    const userAgent =
      request.headers.get('user-agent') || body.userAgent || 'unknown';
    const referer = request.headers.get('referer') || sanitizedUrl;

    // Log error with full context for monitoring
    logger.error('Client-side error reported', {
      error: sanitizedError,
      componentStack: sanitizedStack,
      url: sanitizedUrl,
      referer: sanitizeForLog(truncate(referer, 500)),
      userAgent: truncate(userAgent, 300),
      timestamp: body.timestamp || new Date().toISOString(),
      requestId: request.headers.get('x-request-id') || crypto.randomUUID()
    });

    // Return success (fire-and-forget from client perspective)
    return NextResponse.json(
      {
        success: true,
        data: { received: true }
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to process client error report', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Don't expose internal errors to client
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process error report'
        }
      },
      { status: 500 }
    );
  }
}
