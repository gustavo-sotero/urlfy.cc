/**
 * ═════════════════════════════════════════════════════════════════════
 * API GATEWAY — Forward requests to apps/api (Elysia service)
 * ═════════════════════════════════════════════════════════════════════
 * In the monorepo architecture, the Next.js web app no longer
 * runs Elysia in-process. Instead this route handler proxies
 * all /api/* traffic to the standalone Elysia API service.
 *
 * Middleware applied here (before proxying):
 * - CORS verification
 * - Anti-abuse detection
 * - Gateway-level rate limiting
 *
 * @see docs/architecture/overview.md — Etapa 7 of the monorepo migration
 * ═════════════════════════════════════════════════════════════════════
 */

import type { NextRequest } from 'next/server';
import { getClientIp } from '@/server/lib/ip';
import {
  antiAbuseMiddleware,
  recordLoginFailure
} from '@/server/middleware/anti-abuse';
import { addCORSHeaders, corsMiddleware } from '@/server/middleware/cors';
import { rateLimit } from '@/server/middleware/rate-limit';
import { MetricsService } from '@/server/services/metrics.service';

/** Internal URL of the Elysia API service */
function getApiUrl(): string {
  return process.env.API_INTERNAL_URL || 'http://localhost:3001';
}

async function handle(request: NextRequest): Promise<Response> {
  // Track request for RPS metrics (fire-and-forget, non-blocking)
  MetricsService.trackRequest().catch(() => {
    // Silently ignore tracking errors — metrics should never break requests
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

  // ── Proxy to Elysia API service ──────────────────────────────────
  const url = new URL(request.url);
  const targetUrl = `${getApiUrl()}${url.pathname}${url.search}`;

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('x-forwarded-for', getClientIp(request));
  proxyHeaders.set('x-forwarded-host', url.hostname);
  proxyHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
    // @ts-expect-error — duplex is required for streaming bodies
    duplex: 'half'
  });

  const response = await fetch(proxyRequest);

  // Record login failures for anti-abuse tracking (fire-and-forget)
  if (
    request.method === 'POST' &&
    url.pathname.includes('/auth/sign-in') &&
    (response.status === 401 || response.status === 403)
  ) {
    const clientIp = getClientIp(request);
    recordLoginFailure(clientIp).catch(() => {
      // Intentionally ignored — anti-abuse must never break requests
    });
  }

  const finalResponse = addCORSHeaders(response, request);

  if (rateLimitOutcome.headers) {
    rateLimitOutcome.headers.forEach((value, key) => {
      finalResponse.headers.set(key, value);
    });
  }

  return finalResponse;
}

// HTTP method handlers for Next.js App Router
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
