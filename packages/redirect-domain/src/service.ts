import { trace } from '@opentelemetry/api';
import {
  ALIAS_PATH_SEGMENT_REGEX,
  ALIAS_REDIRECT_PATH_REGEX
} from '@urlfy/contracts/alias-policy';
import type { RedirectError, RedirectResult } from '@urlfy/contracts/redirect';
import { createLogger, recordRedirectMetrics } from '@urlfy/telemetry';
import { cacheService } from './cache-service';
import { getCircuitBreakerStatus, getLink, isCodeAvailable } from './fetcher';
import type {
  RedirectResolveInput,
  RedirectServiceDependencies
} from './types';
import { buildFinalUrl } from './url-builder';
import { validateLink } from './validator';

const logger = createLogger('redirect-service');
const tracer = trace.getTracer('redirect-service');

/** Canonical self-shortener hostnames for redirect-loop detection. */
const SELF_SHORTENER_HOSTS = new Set(['urlfy.cc', 'www.urlfy.cc']);

function isSelfShortenerOrigin(parsed: URL): boolean {
  const hostname = parsed.hostname.toLowerCase();
  if (SELF_SHORTENER_HOSTS.has(hostname)) return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return parsed.origin === new URL(appUrl).origin;
    } catch {
      // ignore malformed env var
    }
  }

  return false;
}

/**
 * Returns true when the resolved URL would re-enter the shortener's own
 * redirect handler, forming a self-referential loop.
 * Matches:
 *   - {appHost}/r/{code}  — explicit redirect route
 *   - {appHost}/{code}    — proxy-intercepted shortcode path (3–20 chars)
 */
function isSelfShortenerLoop(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isSelfShortenerOrigin(parsed)) return false;
    const path = parsed.pathname;
    if (ALIAS_REDIRECT_PATH_REGEX.test(path)) return true;
    return ALIAS_PATH_SEGMENT_REGEX.test(path);
  } catch {
    return false;
  }
}

const defaultRedirectServiceDependencies: RedirectServiceDependencies = {
  fetchLink: (code) => getLink(code),
  isCodeAvailable: (code) => isCodeAvailable(code),
  getCircuitBreakerStatus: () => getCircuitBreakerStatus(),
  getCacheStats: () => cacheService.getCacheStats(),
  buildFinalUrl,
  validateLink
};

function normalizeResolveInput(
  codeOrInput: string | RedirectResolveInput,
  currentDepth?: number,
  bypassPassword?: boolean
): RedirectResolveInput {
  if (typeof codeOrInput === 'string') {
    return {
      linkCode: codeOrInput,
      currentDepth: currentDepth ?? 0,
      bypassPassword: bypassPassword ?? false
    };
  }

  return {
    ...codeOrInput,
    bypassPassword: codeOrInput.bypassPassword ?? false
  };
}

/**
 * Service responsible for short URL redirection
 * Implements Cache-Aside pattern with Stampede Protection
 * Aggregates fetcher, validator and url-builder functionality
 */
export class RedirectService {
  constructor(
    private readonly dependencies: RedirectServiceDependencies = defaultRedirectServiceDependencies
  ) {}

  /**
   * Resolve a short code to destination URL with optional password bypass
   *
   * @param code - Short link code
   * @param currentDepth - Legacy depth value retained for compatibility; loop prevention checks the resolved destination URL.
   * @param bypassPassword - If true, skips password validation (used with valid cookie)
   * @returns Result with destination URL or error
   */
  async resolve(input: RedirectResolveInput): Promise<RedirectResult>;
  async resolve(
    code: string,
    currentDepth: number,
    bypassPassword?: boolean
  ): Promise<RedirectResult>;
  async resolve(
    codeOrInput: string | RedirectResolveInput,
    currentDepth?: number,
    bypassPassword = false
  ): Promise<RedirectResult> {
    const resolvedInput = normalizeResolveInput(
      codeOrInput,
      currentDepth,
      bypassPassword
    );
    const code = resolvedInput.linkCode;
    const depth =
      resolvedInput.requestMeta?.depth ?? resolvedInput.currentDepth;
    const startTime = performance.now();
    let cacheHit = false;

    return tracer.startActiveSpan(
      'redirect.resolve',
      {
        attributes: {
          code,
          depth,
          'request.id': resolvedInput.requestMeta?.requestId ?? '',
          'client.ip': resolvedInput.requestMeta?.ip ?? '',
          'http.referrer': resolvedInput.requestMeta?.referrer ?? ''
        }
      },
      async (span) => {
        try {
          // 1. Fetch link (cache-first with fallback) via Fetcher
          const resolved = await this.dependencies.fetchLink(code);
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
          const validation = this.dependencies.validateLink(
            link,
            resolvedInput.bypassPassword
          );
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
          const finalUrl = this.dependencies.buildFinalUrl(link);

          // 5. Server-side redirect-loop detection
          // Checks the resolved destination URL rather than a client-controlled
          // header, so the guard works correctly across real browser hops.
          if (isSelfShortenerLoop(finalUrl)) {
            logger.warn('Redirect loop detected via destination URL', {
              code,
              finalUrl,
              requestId: resolvedInput.requestMeta?.requestId
            });
            span.setStatus({ code: 1, message: 'REDIRECT_LOOP' });

            recordRedirectMetrics({
              latencyMs: performance.now() - startTime,
              success: false,
              cacheHit,
              errorType: 'REDIRECT_LOOP'
            });

            return {
              success: false,
              error: 'REDIRECT_LOOP' as RedirectError,
              linkId: link.id
            };
          }

          const latency = performance.now() - startTime;
          logger.info('Redirect resolved', {
            code,
            linkId: link.id,
            redirectType: link.redirectType,
            latencyMs: latency.toFixed(2),
            requestId: resolvedInput.requestMeta?.requestId,
            clientIp: resolvedInput.requestMeta?.ip
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
            cacheHit,
            requiresClickReservation: link.maxClicks != null
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
    return this.dependencies.isCodeAvailable(code);
  }

  /**
   * Get redirect service health stats
   */
  async getHealthStats(): Promise<{
    circuitBreaker: string;
    cacheStats: Awaited<ReturnType<typeof cacheService.getCacheStats>>;
  }> {
    return {
      circuitBreaker: this.dependencies.getCircuitBreakerStatus(),
      cacheStats: await this.dependencies.getCacheStats()
    };
  }
}

export function createRedirectService(
  dependencies: Partial<RedirectServiceDependencies> = {}
): RedirectService {
  return new RedirectService({
    ...defaultRedirectServiceDependencies,
    ...dependencies
  });
}

// Singleton instance
export const redirectService = createRedirectService();
