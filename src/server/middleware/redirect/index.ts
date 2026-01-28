// src/server/middleware/redirect/index.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT MIDDLEWARE - Main Entry Point
 * ═════════════════════════════════════════════════════════════════════
 * Orchestrates the redirect flow using modular components:
 * - validator.ts: Request validation (host, depth)
 * - resolver.ts: Link resolution via internal API
 * - error-handler.ts: Error code mapping and response shaping
 * - analytics.ts: Click event dispatch
 *
 * This module only handles orchestration logic.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/server/lib/telemetry.edge';
import { enqueueClickEvent } from './analytics';
import { createRedirectResponse, handleRedirectError } from './error-handler';
import { resolveLink } from './resolver';
import type { RedirectErrorCode } from './types';
import { validateRedirectRequest } from './validator';

const logger = createLogger('redirect-middleware');

/**
 * Main redirect handler
 * Executed by Next.js middleware when a /:code route is accessed
 *
 * @param request - Incoming Next.js request
 * @param shortCode - Short code to resolve
 * @returns Response with redirect or error
 */
export async function handleRedirect(
  request: NextRequest,
  shortCode: string
): Promise<NextResponse> {
  const startTime = performance.now();

  // 1. Validate request
  const validation = validateRedirectRequest(request, shortCode);

  if (!validation.valid) {
    logger.warn('Request validation failed', {
      shortCode,
      error: validation.error,
      host: request.headers.get('host')
    });

    return handleRedirectError(
      validation.error,
      shortCode,
      crypto.randomUUID()
    );
  }

  const { context } = validation;

  try {
    // 2. Resolve link via internal API
    const result = await resolveLink(context);

    if (!result.success) {
      return handleRedirectError(
        result.error as RedirectErrorCode,
        shortCode,
        context.requestId,
        result.retryAfter
      );
    }

    // 3. Dispatch analytics event (async, non-blocking)
    if (result.linkId) {
      enqueueClickEvent(
        request,
        shortCode,
        context.requestId,
        result.linkId
      ).catch((error) => {
        // Log but don't fail the redirect
        logger.error('Failed to enqueue click event', {
          shortCode,
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    // 4. Log completion
    const latency = performance.now() - startTime;
    const cacheStatus =
      result.response?.headers.get('X-Internal-Cache-Status') || 'UNKNOWN';
    const cacheHit = cacheStatus === 'HIT';

    logger.info('Redirect completed', {
      shortCode,
      redirectType: result.redirectType,
      latencyMs: latency.toFixed(2),
      cacheHit,
      requestId: context.requestId
    });

    // 5. Return redirect response
    return createRedirectResponse(
      result.url ?? 'https://urlfy.cc',
      (result.redirectType as 301 | 302) ?? 302,
      context.requestId,
      context.depth,
      cacheHit
    );
  } catch (error) {
    const latency = performance.now() - startTime;

    logger.error('Redirect error', {
      shortCode,
      requestId: context.requestId,
      latencyMs: latency.toFixed(2),
      error: error instanceof Error ? error.message : String(error)
    });

    return handleRedirectError('INTERNAL_ERROR', shortCode, context.requestId);
  }
}

export type {
  RedirectContext,
  RedirectErrorCode,
  ResolveResult,
  ValidationResult
} from './types';
// Re-export types and utilities for backwards compatibility
export { getPasswordToken } from './validator';
