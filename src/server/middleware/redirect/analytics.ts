// src/server/middleware/redirect/analytics.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT ANALYTICS
 * ═════════════════════════════════════════════════════════════════════
 * Click event preparation and dispatch for redirect analytics
 */

import type { NextRequest } from 'next/server';
import { getClientIp } from '@/server/lib/ip';
import { createLogger } from '@/server/lib/telemetry.edge';
import type { ClickEvent } from '@/types/analytics.types';

const logger = createLogger('redirect-analytics');

/**
 * Get the internal API base URL
 */
function getInternalApiBase(): string {
  return process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000';
}

/**
 * Prepare a click event from request data
 *
 * @param request - Incoming request
 * @param shortCode - Short code being accessed
 * @param requestId - Request identifier
 * @param linkId - Resolved link ID
 * @returns Prepared click event
 */
function prepareClickEvent(
  request: NextRequest,
  shortCode: string,
  requestId: string,
  linkId: string
): ClickEvent {
  const searchParams = request.nextUrl.searchParams;

  return {
    linkId,
    shortCode,
    timestamp: new Date(),
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? null,
    referer: request.headers.get('referer') ?? null,
    requestId,
    acceptLanguage: request.headers.get('accept-language') ?? null,
    utmSource: searchParams.get('utm_source'),
    utmMedium: searchParams.get('utm_medium'),
    utmCampaign: searchParams.get('utm_campaign'),
    utmContent: searchParams.get('utm_content'),
    utmTerm: searchParams.get('utm_term')
  };
}

/**
 * Dispatch a click event to the internal analytics API
 * This is fire-and-forget - errors are logged but don't block the redirect
 *
 * @param request - Incoming request
 * @param shortCode - Short code being accessed
 * @param requestId - Request identifier
 * @param linkId - Resolved link ID
 */
export async function enqueueClickEvent(
  request: NextRequest,
  shortCode: string,
  requestId: string,
  linkId: string
): Promise<void> {
  try {
    const event = prepareClickEvent(request, shortCode, requestId, linkId);

    const internalApiBase = getInternalApiBase();
    const internalToken = process.env.INTERNAL_API_SECRET || '';

    // Fire and forget - don't await response to avoid blocking redirect
    fetch(`${internalApiBase}/api/internal/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api': internalToken
      },
      body: JSON.stringify(event)
    }).catch((error) => {
      logger.error('Failed to call internal analytics API', {
        shortCode,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    logger.debug('Click event dispatched to internal API', {
      shortCode,
      requestId
    });
  } catch (error) {
    logger.error('Failed to prepare click event', {
      shortCode,
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
