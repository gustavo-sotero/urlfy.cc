import {
  drainPendingClicks,
  incrementPendingClicks,
  RedisStream,
  STREAM_NAMES
} from '@urlfy/cache';
import type { NextRequest } from 'next/server';
import { getClientIp } from './ip';

export async function reserveRedirectPendingClick(
  linkId: string
): Promise<number | null> {
  return incrementPendingClicks(linkId);
}

export async function revertRedirectPendingClick(
  linkId: string
): Promise<void> {
  await drainPendingClicks(linkId);
}

export async function enqueueRedirectAnalytics(
  request: NextRequest,
  code: string,
  linkId: string
): Promise<void> {
  const searchParams = request.nextUrl.searchParams;

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
}
