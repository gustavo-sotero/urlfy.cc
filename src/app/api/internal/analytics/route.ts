// src/app/api/internal/analytics/route.ts

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import type { ClickEvent } from '@/types/analytics.types';

/**
 * Internal API endpoint to enqueue analytics events
 * This endpoint is NOT publicly exposed - only for internal middleware calls
 *
 * IMPORTANT: Runs on Node.js runtime (not Edge), where Redis Streams works
 */

export const runtime = 'nodejs'; // Force Node.js runtime (not Edge)

export async function POST(request: Request) {
  try {
    // Validate internal token using INTERNAL_ANALYTICS_SECRET (preferred) or INTERNAL_API_SECRET
    const internalToken = request.headers.get('x-internal-api');
    const expectedToken =
      process.env.INTERNAL_ANALYTICS_SECRET || process.env.INTERNAL_API_SECRET;

    if (!internalToken || !expectedToken) {
      return NextResponse.json(
        { error: 'Forbidden - Invalid internal token' },
        { status: 403 }
      );
    }

    // Timing-safe comparison to prevent timing attacks
    const a = Buffer.from(internalToken);
    const b = Buffer.from(expectedToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json(
        { error: 'Forbidden - Invalid internal token' },
        { status: 403 }
      );
    }

    const event: ClickEvent = await request.json();

    // Validate required fields
    if (!event.linkId || !event.shortCode) {
      return NextResponse.json(
        { error: 'Invalid event data' },
        { status: 400 }
      );
    }

    // Enqueue event using Redis Streams
    // The worker will enrich it (GeoIP, User-Agent parsing, etc.)
    await RedisStream.add(STREAM_NAMES.analyticsClicks, {
      linkId: event.linkId,
      shortCode: event.shortCode,
      ip: event.ip || '',
      userAgent: event.userAgent || '',
      referer: event.referer || '',
      utmSource: event.utmSource || '',
      utmMedium: event.utmMedium || '',
      utmCampaign: event.utmCampaign || '',
      utmContent: event.utmContent || '',
      utmTerm: event.utmTerm || '',
      timestamp:
        typeof event.timestamp === 'string'
          ? event.timestamp
          : event.timestamp instanceof Date
            ? event.timestamp.toISOString()
            : new Date().toISOString()
    });

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('Failed to enqueue analytics event:', error);
    // Return 202 even on error - avoid breaking redirects
    return NextResponse.json({ success: false }, { status: 202 });
  }
}
