// Initialize telemetry before API

import { api } from '@/server';
import { antiAbuseMiddleware } from '@/server/middleware/anti-abuse';
import { addCORSHeaders, corsMiddleware } from '@/server/middleware/cors';
import { rateLimit } from '@/server/middleware/rate-limit';
import { MetricsService } from '@/server/services/metrics.service';
import type { NextRequest } from 'next/server';

async function handle(request: NextRequest): Promise<Response> {
  // Track request for RPS metrics (fire-and-forget, non-blocking)
  MetricsService.trackRequest().catch(() => {
    // Silently ignore tracking errors - metrics should never break requests
  });

  const preflight = await corsMiddleware(request);
  if (preflight) return preflight;

  const antiAbuseResponse = await antiAbuseMiddleware(request);
  if (antiAbuseResponse) {
    return addCORSHeaders(antiAbuseResponse, request);
  }

  const rateLimitOutcome = await rateLimit(
    request,
    (request as NextRequest & { ip?: string }).ip
  );
  if (rateLimitOutcome.response) {
    return addCORSHeaders(rateLimitOutcome.response, request);
  }

  const response = await api.handle(request);
  const finalResponse = addCORSHeaders(response, request);

  if (rateLimitOutcome.headers) {
    rateLimitOutcome.headers.forEach((value, key) => {
      finalResponse.headers.set(key, value);
    });
  }

  return finalResponse;
}

// ElysiaJS integration with Next.js App Router
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
