// src/app/api/internal/analytics/route.ts

import { NextResponse } from 'next/server';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import type { ClickEvent } from '@/types/analytics.types';

/**
 * Internal API endpoint para enfileirar eventos de analytics
 * Este endpoint NÃO é exposto publicamente - apenas para chamadas internas do middleware
 *
 * IMPORTANTE: Roda no Node.js runtime (não Edge), onde Redis Streams funciona
 */

export const runtime = 'nodejs'; // Force Node.js runtime (not Edge)

export async function POST(request: Request) {
  try {
    // Verifica token interno usando INTERNAL_ANALYTICS_SECRET (preferido) ou INTERNAL_API_SECRET
    const internalToken = request.headers.get('x-internal-token');
    const expectedToken =
      process.env.INTERNAL_ANALYTICS_SECRET || process.env.INTERNAL_API_SECRET;

    if (!internalToken || !expectedToken || internalToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Forbidden - Invalid internal token' },
        { status: 403 }
      );
    }

    const event: ClickEvent = await request.json();

    // Valida campos mínimos
    if (!event.linkId || !event.shortCode) {
      return NextResponse.json(
        { error: 'Invalid event data' },
        { status: 400 }
      );
    }

    // Enfileira evento usando Redis Streams
    // O worker fará o enriquecimento (GeoIP, User-Agent parsing, etc)
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
    // Retorna 202 mesmo com erro - não queremos falhar o redirect
    return NextResponse.json({ success: false }, { status: 202 });
  }
}
