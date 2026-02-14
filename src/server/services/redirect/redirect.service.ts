import { createLogger, recordRedirectMetrics } from '@/server/lib/telemetry';
import type { RedirectError, RedirectResult } from '@/types/redirect.types';
import { trace } from '@opentelemetry/api';
import { cacheService } from '../cache.service';
import * as Fetcher from './fetcher';
import { buildFinalUrl } from './url-builder';
import { validateLink } from './validator';

const logger = createLogger('redirect-service');
const tracer = trace.getTracer('redirect-service');

/**
 * Service responsible for short URL redirection
 * Implements Cache-Aside pattern with Stampede Protection
 * Aggregates fetcher, validator and url-builder functionality
 */
export class RedirectService {
  /**
   * Resolve a short code to destination URL with optional password bypass
   *
   * @param code - Short link code
   * @param currentDepth - Current redirect depth (prevents loops)
   * @param bypassPassword - If true, skips password validation (used with valid cookie)
   * @returns Result with destination URL or error
   */
  async resolve(
    code: string,
    currentDepth: number,
    bypassPassword = false
  ): Promise<RedirectResult> {
    const startTime = performance.now();
    let cacheHit = false;

    return tracer.startActiveSpan(
      'redirect.resolve',
      { attributes: { code, depth: currentDepth } },
      async (span) => {
        try {
          // 1. Check redirect depth
          if (currentDepth >= 3) {
            logger.warn('Redirect loop detected', {
              code,
              depth: currentDepth
            });
            span.setStatus({ code: 1, message: 'REDIRECT_LOOP' });

            recordRedirectMetrics({
              latencyMs: performance.now() - startTime,
              success: false,
              cacheHit: false,
              errorType: 'REDIRECT_LOOP'
            });

            return { success: false, error: 'REDIRECT_LOOP' as RedirectError };
          }

          // 2. Fetch link (cache-first with fallback) via Fetcher
          const resolved = await Fetcher.getLink(code);
          const link = resolved.link;
          cacheHit = resolved.cacheHit;

          if (!link) {
            span.setStatus({ code: 1, message: 'NOT_FOUND' });

            recordRedirectMetrics({
              latencyMs: performance.now() - startTime,
              success: false,
              cacheHit: false,
              errorType: 'NOT_FOUND'
            });

            return { success: false, error: 'NOT_FOUND' as RedirectError };
          }

          // 3. Status validations
          const validation = validateLink(link, bypassPassword);
          if (!validation.valid) {
            span.setStatus({ code: 1, message: validation.error });

            recordRedirectMetrics({
              latencyMs: performance.now() - startTime,
              success: false,
              cacheHit,
              errorType: validation.error
            });

            return {
              success: false,
              error: validation.error,
              linkId: link.id
            };
          }

          // 4. Build final URL with UTMs
          const finalUrl = buildFinalUrl(link);

          const latency = performance.now() - startTime;
          logger.info('Redirect resolved', {
            code,
            linkId: link.id,
            redirectType: link.redirectType,
            latencyMs: latency.toFixed(2)
          });

          span.setStatus({ code: 0 });
          span.setAttributes({
            'link.id': link.id,
            'link.redirectType': link.redirectType,
            'cache.hit': cacheHit
          });

          recordRedirectMetrics({
            latencyMs: latency,
            success: true,
            cacheHit,
            errorType: undefined
          });

          return {
            success: true,
            url: finalUrl,
            redirectType: link.redirectType,
            linkId: link.id,
            cacheHit
          };
        } catch (error) {
          const latency = performance.now() - startTime;
          logger.error('Error resolving redirect', {
            code,
            error: error instanceof Error ? error.message : String(error),
            latencyMs: latency.toFixed(2)
          });

          span.recordException(error as Error);
          span.setStatus({ code: 2, message: 'Internal error' });

          recordRedirectMetrics({
            latencyMs: latency,
            success: false,
            cacheHit: false,
            errorType: 'INTERNAL_ERROR'
          });

          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Check if a short link code is available
   * (used when creating custom links)
   */
  async isCodeAvailable(code: string): Promise<boolean> {
    return Fetcher.isCodeAvailable(code);
  }

  /**
   * Get redirect service health stats
   */
  async getHealthStats(): Promise<{
    circuitBreaker: string;
    cacheStats: Awaited<ReturnType<typeof cacheService.getCacheStats>>;
  }> {
    return {
      circuitBreaker: Fetcher.getCircuitBreakerStatus(),
      cacheStats: await cacheService.getCacheStats()
    };
  }
}

// Singleton instance
export const redirectService = new RedirectService();
