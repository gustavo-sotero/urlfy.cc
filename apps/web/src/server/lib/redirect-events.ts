import { createHash } from 'node:crypto';
import {
  drainPendingClicks,
  incrementPendingClicks,
  RedisStream,
  STREAM_NAMES
} from '@urlfy/cache';
import { lookupGeoIP } from '@urlfy/geoip';
import type { NextRequest } from 'next/server';
import { getClientIp } from './ip';

// ─── visitor hash ─────────────────────────────────────────────────────────────
// Mirror the logic in apps/worker/src/server/lib/privacy.ts so that the hash
// is computed at ingress (before Redis) rather than at the consumer (after Redis).
// ISO week number calculation — same algorithm as privacy.ts.
function getIsoWeekSalt(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashVisitorAtIngress(ip: string | null, linkId: string): string {
  const salt = getIsoWeekSalt();
  if (!ip || ip.trim() === '') {
    return createHash('sha256')
      .update(`anonymous:${linkId}:${salt}`)
      .digest('hex');
  }
  return createHash('sha256').update(`${ip}:${linkId}:${salt}`).digest('hex');
}

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
  const visitorHash = hashVisitorAtIngress(rawIp, linkId);

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
