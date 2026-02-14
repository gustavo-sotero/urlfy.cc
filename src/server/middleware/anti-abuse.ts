/**
 * Anti-Abuse Middleware
 * Integrates anti-abuse detection into request processing
 */

import { getClientIp, maskIpForLog } from '@/server/lib/ip';
import { createLogger } from '@/server/lib/telemetry';
import { antiAbuseService } from '@/server/services/anti-abuse.service';

const logger = createLogger('anti-abuse-middleware');

/**
 * Anti-abuse middleware handler
 */
export async function antiAbuseMiddleware(
  request: Request
): Promise<Response | null> {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;

  // Skip health checks
  if (path.startsWith('/api/health')) {
    return null;
  }

  // Check if IP is blocked
  const isBlocked = await antiAbuseService.isIPBlocked(ip);

  if (isBlocked) {
    logger.warn('Blocked IP attempted request', { ip: maskIpForLog(ip), path });
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
      logger.warn('IP auto-blocked due to excessive login failures', {
        ip: maskIpForLog(ip)
      });
    }
  } catch (error) {
    logger.error('Failed to record login failure', {
      error: error instanceof Error ? error.message : String(error),
      ip: maskIpForLog(ip)
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
      logger.warn('Anomalous link creation detected', {
        userId,
        ip: maskIpForLog(ip)
      });
    }
  } catch (error) {
    logger.error('Failed to record link creation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      ip: maskIpForLog(ip)
    });
  }
}
