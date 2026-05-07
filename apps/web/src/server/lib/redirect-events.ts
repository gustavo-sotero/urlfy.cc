import {
  drainPendingClicks,
  incrementPendingClicks,
  RedisStream,
  STREAM_NAMES
} from '@urlfy/cache';
import { lookupGeoIP } from '@urlfy/geoip';
import { hashVisitorForAnalytics } from '@urlfy/telemetry';
import type { NextRequest } from 'next/server';
import { getClientIp } from './ip';

// ─── public helpers ───────────────────────────────────────────────────────────

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
  const rawIp = getClientIp(request);

  // Hash immediately — raw IP must never be written to Redis.
  const visitorHash = hashVisitorForAnalytics(rawIp, linkId);

  // Resolve GeoIP at ingress so the stream payload never needs the raw IP.
  // lookupGeoIP uses an in-process MaxMind reader with Redis caching, so the
  // incremental cost is negligible on warm paths.
  const geo = await lookupGeoIP(rawIp).catch(() => null);

  await RedisStream.add(
    STREAM_NAMES.analyticsClicks,
    {
      linkId,
      shortCode: code,
      visitorHash,
      country: geo?.country ?? '',
      city: geo?.city ?? '',
      latitude: geo?.latitude != null ? String(geo.latitude) : '',
      longitude: geo?.longitude != null ? String(geo.longitude) : '',
      userAgent: request.headers.get('user-agent') ?? '',
      referer: request.headers.get('referer') ?? '',
      utmSource: searchParams.get('utm_source') ?? '',
      utmMedium: searchParams.get('utm_medium') ?? '',
      utmCampaign: searchParams.get('utm_campaign') ?? '',
      utmContent: searchParams.get('utm_content') ?? '',
      utmTerm: searchParams.get('utm_term') ?? '',
      timestamp: new Date().toISOString()
    },
    '*',
    50_000
  );
}
