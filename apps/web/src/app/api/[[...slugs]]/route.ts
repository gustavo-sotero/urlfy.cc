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
import { createStreamingRequest } from '@/server/lib/streaming-request';
import { fireAndForget } from '@/server/lib/telemetry';
import {
  antiAbuseMiddleware,
  recordLoginFailure
} from '@/server/middleware/anti-abuse';
import { addCORSHeaders, corsMiddleware } from '@/server/middleware/cors';
import { rateLimit } from '@/server/middleware/rate-limit';
import { MetricsService } from '@/server/services/metrics.service';

/** Internal URL of the Elysia API service */
function getApiUrl(): string {
  const raw = process.env.API_INTERNAL_URL || 'http://localhost:3001';
  try {
    const parsed = new URL(raw);
    // Only allow http/https to prevent SSRF via other protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
    return raw;
  } catch {
    // Fail loudly at startup rather than silently using a bad URL
    throw new Error(`Invalid API_INTERNAL_URL: ${raw}`);
  }
}

/** Keep gateway waits bounded to avoid hanging requests when API is degraded. */
const API_PROXY_TIMEOUT_MS = 8000;

function buildGatewayErrorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message
      },
      requestId
    }),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId
      }
    }
  );
}

async function handle(request: NextRequest): Promise<Response> {
  const requestId =
    request.headers.get('x-request-id') ||
    `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requestPath = new URL(request.url).pathname;

  // Track request for RPS metrics (fire-and-forget, non-blocking)
  fireAndForget('gateway-track-request', () => MetricsService.trackRequest(), {
    method: request.method,
    path: requestPath,
    requestId
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
  proxyHeaders.set('x-request-id', requestId);
  proxyHeaders.set('x-forwarded-for', getClientIp(request));
  proxyHeaders.set('x-forwarded-host', url.hostname);
  proxyHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    API_PROXY_TIMEOUT_MS
  );

  let response: Response;
  try {
    const proxyRequest = createStreamingRequest(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      signal: abortController.signal
    });

    response = await fetch(proxyRequest);
  } catch (error) {
    clearTimeout(timeout);
    const isAbort =
      error instanceof DOMException && error.name === 'AbortError';
    const code = isAbort ? 'API_TIMEOUT' : 'API_UNAVAILABLE';
    const message = isAbort
      ? 'API upstream timeout'
      : 'API upstream unavailable';

    const gatewayErrorResponse = buildGatewayErrorResponse(
      requestId,
      503,
      code,
      message
    );
    return addCORSHeaders(gatewayErrorResponse, request);
  } finally {
    clearTimeout(timeout);
  }

  // Record login failures for anti-abuse tracking (fire-and-forget)
  if (
    request.method === 'POST' &&
    url.pathname.includes('/auth/sign-in') &&
    (response.status === 401 || response.status === 403)
  ) {
    const clientIp = getClientIp(request);
    fireAndForget(
      'gateway-record-login-failure',
      () => recordLoginFailure(clientIp),
      {
        path: url.pathname,
        requestId,
        status: response.status
      }
    );
  }

  const finalResponse = addCORSHeaders(response, request);

  if (!finalResponse.headers.get('x-request-id')) {
    finalResponse.headers.set('x-request-id', requestId);
  }

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
