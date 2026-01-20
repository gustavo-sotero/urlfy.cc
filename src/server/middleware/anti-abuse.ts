/**
 * Anti-Abuse Middleware
 * Integrates anti-abuse detection into request processing
 */

import { createLogger } from '@/server/lib/telemetry';
import { antiAbuseService } from '@/server/services/anti-abuse.service';

const logger = createLogger('anti-abuse-middleware');

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('X-Forwarded-For');

  if (process.env.TRUST_PROXY === 'true' && forwarded) {
    return forwarded.split(',')[0]?.trim() || '127.0.0.1';
  }

  return '127.0.0.1';
}

/**
 * Anti-abuse middleware handler
 */
export async function antiAbuseMiddleware(
  request: Request
): Promise<Response | null> {
  const ip = getClientIP(request);
  const path = new URL(request.url).pathname;

  // Skip health checks
  if (path.startsWith('/api/health')) {
    return null;
  }

  // Check if IP is blocked
  const isBlocked = await antiAbuseService.isIPBlocked(ip);

  if (isBlocked) {
    logger.warn('Blocked IP attempted request', { ip, path });
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'BLOCKED',
          message:
            'Your IP has been blocked due to suspicious activity. Please contact support.'
        }
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // No blocking needed
  return null;
}

/**
 * Record login failure for anti-abuse tracking
 */
export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    const blocked = await antiAbuseService.recordLoginFailure(ip);
    if (blocked) {
      logger.warn('IP auto-blocked due to excessive login failures', { ip });
    }
  } catch (error) {
    logger.error('Failed to record login failure', {
      error: error instanceof Error ? error.message : String(error),
      ip
    });
  }
}

/**
 * Record link creation for abuse detection
 */
export async function recordLinkCreation(
  userId: string | null,
  ip: string
): Promise<void> {
  try {
    const anomalous = await antiAbuseService.recordLinkCreation(userId, ip);
    if (anomalous) {
      logger.warn('Anomalous link creation detected', { userId, ip });
    }
  } catch (error) {
    logger.error('Failed to record link creation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      ip
    });
  }
}
