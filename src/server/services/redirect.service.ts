// src/server/services/redirect.service.ts

import { db } from '@/db';
import * as schema from '@/db/schema';

const { links } = schema;

import { trace } from '@opentelemetry/api';
import { eq } from 'drizzle-orm';
import { CircuitBreaker } from '@/server/lib/circuit-breaker';
import { acquireLock, releaseLock } from '@/server/lib/distributed-lock';
import {
  cacheHits,
  cacheMisses,
  createLogger,
  recordRedirectMetrics,
  redisFallbacks,
  stampedeLocksAcquired,
  stampedeLocksWaited
} from '@/server/lib/telemetry';
import type {
  CachedLink,
  RedirectError,
  RedirectResult
} from '@/types/redirect.types';
import { CACHE_PREFIX, cacheService } from './cache.service';

const logger = createLogger('redirect-service');
const tracer = trace.getTracer('redirect-service');

// Lock TTL para stampede protection (5 segundos)
const LOCK_TTL = 5000;

// Circuit breaker para PostgreSQL
const dbCircuitBreaker = new CircuitBreaker({
  name: 'postgres-redirect',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 10000
});

/**
 * Service responsável pelo redirecionamento de URLs curtas
 * Implementa Cache-Aside pattern com Stampede Protection
 */
export class RedirectService {
  /**
   * Resolve um short code para URL de destino com bypass de senha opcional
   *
   * @param code - Código curto do link
   * @param currentDepth - Profundidade atual de redirects (para prevenir loops)
   * @param bypassPassword - Se true, ignora validação de senha (usado quando cookie válido)
   * @returns Resultado com URL de destino ou erro
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
          // 1. Verifica profundidade de redirect
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

          // 2. Busca link (cache-first com fallback)
          const resolved = await this.getLink(code);
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

          // 3. Validações de status
          const validation = this.validateLink(link, bypassPassword);
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

          // 4. Monta URL final com UTMs
          const finalUrl = this.buildFinalUrl(link);

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
            linkId: link.id
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
   * Busca link com estratégia Cache-Aside
   * Inclui proteção contra Cache Stampede
   */
  private async getLink(code: string): Promise<{
    link: CachedLink | null;
    cacheHit: boolean;
  }> {
    return tracer.startActiveSpan(
      'redirect.getLink',
      { attributes: { code } },
      async (span) => {
        try {
          let cacheHit = false;
          // L1: Verifica cache negativo primeiro (404)
          const is404 = await cacheService.isNotFound(code);
          if (is404) {
            logger.debug('Negative cache hit', { code });
            span.setAttribute('cache.type', 'negative');
            span.setAttribute('cache.hit', true);
            cacheHits.add(1, { type: 'negative' });
            cacheHit = true;
            return { link: null, cacheHit };
          }

          // L2: Verifica cache de link banido
          const isBanned = await cacheService.isBanned(code);
          if (isBanned) {
            logger.debug('Banned cache hit', { code });
            span.setAttribute('cache.type', 'banned');
            span.setAttribute('cache.hit', true);
            cacheHits.add(1, { type: 'banned' });
            // Retorna um link "fantasma" para validação retornar BANNED
            // IMPORTANTE: isActive DEVE ser true para que validateLink chegue na checagem de isBanned
            cacheHit = true;
            return {
              link: {
                id: 'banned',
                originalUrl: '',
                redirectType: 302 as const,
                isActive: true,
                isBanned: true,
                expiresAt: null,
                maxClicks: null,
                clicksCount: 0,
                passwordHash: null,
                utmSource: null,
                utmMedium: null,
                utmCampaign: null
              },
              cacheHit
            };
          }

          // L3: Verifica cache normal de link
          const cached = await cacheService.getLink(code);
          if (cached) {
            logger.debug('Link cache hit', { code });
            span.setAttribute('cache.type', 'link');
            span.setAttribute('cache.hit', true);
            cacheHits.add(1, { type: 'link' });
            cacheHit = true;
            return { link: cached, cacheHit };
          }

          // L4: Cache miss - busca no banco com stampede protection
          logger.debug('Cache miss', { code });
          span.setAttribute('cache.hit', false);
          cacheMisses.add(1);
          return {
            link: await this.fetchWithStampedeProtection(code),
            cacheHit
          };
        } catch (error) {
          // Fallback: busca direto no banco em caso de erro no Redis
          logger.warn('Redis error, falling back to database', {
            code,
            error: error instanceof Error ? error.message : String(error)
          });
          span.recordException(error as Error);
          span.setAttribute('fallback', true);
          redisFallbacks.add(1);
          return { link: await this.fetchFromDatabase(code), cacheHit: false };
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Proteção contra Cache Stampede usando Distributed Lock
   *
   * Quando múltiplas requests chegam simultaneamente para um link não cacheado,
   * apenas uma vai buscar no banco enquanto as outras aguardam.
   */
  private async fetchWithStampedeProtection(
    code: string
  ): Promise<CachedLink | null> {
    const lockKey = `${CACHE_PREFIX.LOCK}${code}`;

    // Tenta adquirir o lock
    const acquired = await acquireLock(lockKey, LOCK_TTL);

    if (acquired) {
      // Esta request ganhou o lock - busca do banco
      stampedeLocksAcquired.add(1);
      try {
        logger.debug('Lock acquired, fetching from database', { code });

        const link = await this.fetchFromDatabase(code);

        if (link) {
          // Popula cache
          await cacheService.setLink(code, link);
        } else {
          // Cache negativo
          await cacheService.setNotFound(code);
        }

        return link;
      } finally {
        // Sempre libera o lock
        await releaseLock(lockKey);
      }
    }

    // Outra request está populando o cache - aguarda um pouco
    stampedeLocksWaited.add(1);
    logger.debug('Lock not acquired, waiting for cache population', { code });
    await Bun.sleep(50); // 50ms

    // Tenta pegar do cache novamente (provavelmente já foi populado)
    const cached = await cacheService.getLink(code);
    if (cached) {
      return cached;
    }

    // Se ainda não está no cache, faz fallback para busca direta
    logger.warn('Cache still empty after waiting, fetching from database', {
      code
    });
    return this.fetchFromDatabase(code);
  }

  /**
   * Busca no PostgreSQL com Circuit Breaker
   */
  private async fetchFromDatabase(code: string): Promise<CachedLink | null> {
    return dbCircuitBreaker.execute(async () => {
      // Use select direto com where ao invés de query builder devido a type issues
      const results = await db
        .select({
          id: links.id,
          originalUrl: links.originalUrl,
          redirectType: links.redirectType,
          isActive: links.isActive,
          isBanned: links.isBanned,
          expiresAt: links.expiresAt,
          maxClicks: links.maxClicks,
          clicksCount: links.clicksCount,
          passwordHash: links.passwordHash,
          utmSource: links.utmSource,
          utmMedium: links.utmMedium,
          utmCampaign: links.utmCampaign
        })
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

      const link = results[0];

      if (!link) {
        logger.debug('Link not found in database', { code });
        return null;
      }

      // Converte para CachedLink (timestamp para string)
      return {
        id: link.id,
        originalUrl: link.originalUrl,
        redirectType: link.redirectType as 301 | 302,
        isActive: link.isActive,
        isBanned: link.isBanned,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        maxClicks: link.maxClicks,
        clicksCount: link.clicksCount,
        passwordHash: link.passwordHash,
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign
      } as CachedLink;
    });
  }

  /**
   * Validações de status do link
   *
   * @param link - Link a ser validado
   * @param bypassPassword - Se true, ignora verificação de senha
   */
  private validateLink(
    link: CachedLink,
    bypassPassword = false
  ): {
    valid: boolean;
    error?: RedirectError;
  } {
    // 1. Link inativo
    if (!link.isActive) {
      logger.debug('Link is inactive', { linkId: link.id });
      return { valid: false, error: 'INACTIVE' };
    }

    // 2. Link banido
    if (link.isBanned) {
      logger.debug('Link is banned', { linkId: link.id });
      return { valid: false, error: 'BANNED' };
    }

    // 3. Link expirado
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      logger.debug('Link expired', {
        linkId: link.id,
        expiresAt: link.expiresAt
      });
      return { valid: false, error: 'EXPIRED' };
    }

    // 4. Limite de cliques atingido
    if (link.maxClicks && link.clicksCount >= link.maxClicks) {
      logger.debug('Max clicks reached', {
        linkId: link.id,
        clicks: link.clicksCount,
        max: link.maxClicks
      });
      return { valid: false, error: 'MAX_CLICKS' };
    }

    // 5. Protegido por senha (a menos que bypassPassword seja true)
    if (link.passwordHash && !bypassPassword) {
      logger.debug('Link requires password', { linkId: link.id });
      return { valid: false, error: 'PASSWORD_REQUIRED' };
    }

    return { valid: true };
  }

  /**
   * Monta URL final com parâmetros UTM
   */
  private buildFinalUrl(link: CachedLink): string {
    try {
      const url = new URL(link.originalUrl);

      // Adiciona UTMs se configurados
      if (link.utmSource) {
        url.searchParams.set('utm_source', link.utmSource);
      }
      if (link.utmMedium) {
        url.searchParams.set('utm_medium', link.utmMedium);
      }
      if (link.utmCampaign) {
        url.searchParams.set('utm_campaign', link.utmCampaign);
      }

      return url.toString();
    } catch (error) {
      logger.error('Error building final URL', {
        linkId: link.id,
        originalUrl: link.originalUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      // Retorna URL original em caso de erro
      return link.originalUrl;
    }
  }

  /**
   * Verifica se um código de short link está disponível
   * (usado na criação de links customizados)
   */
  async isCodeAvailable(code: string): Promise<boolean> {
    try {
      // Verifica cache primeiro
      const cached = await cacheService.getLink(code);
      if (cached) {
        return false;
      }

      // Verifica banco usando select direto
      const results = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

      return results.length === 0;
    } catch (error) {
      logger.error('Error checking code availability', {
        code,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Obtém estatísticas de health do redirect service
   */
  async getHealthStats(): Promise<{
    circuitBreaker: string;
    cacheStats: Awaited<ReturnType<typeof cacheService.getCacheStats>>;
  }> {
    return {
      circuitBreaker: dbCircuitBreaker.getStatus(),
      cacheStats: await cacheService.getCacheStats()
    };
  }
}

// Singleton instance
export const redirectService = new RedirectService();
