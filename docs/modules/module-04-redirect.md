# Módulo 4: Redirect Engine (Hot Path)

> 📖 [← Módulo 3: Gestão de Links](./module-03-links.md) | [Módulo 5: Analytics →](./module-05-analytics.md)

**Requisitos Cobertos:** RF-12 a RF-16, RNF-06, RNF-08, Arch Overview, Caching Strategy

---

## 1. Visão Geral

Este módulo implementa o **caminho crítico de performance** do sistema: o redirecionamento de URLs curtas para destinos originais. É a funcionalidade mais acessada e deve ter latência mínima.

### Status Atual no Monorepo

A implementação atual do hot path não vive mais em `src/server/services` nem em um middleware isolado dentro do app monolítico. Hoje o fluxo real é:

- `apps/web/src/proxy.ts` classifica a rota curta e reescreve para `/r/{code}`
- `apps/web/src/app/r/[code]/route.ts` executa o handler HTTP em Node.js
- `packages/redirect-domain` resolve cache, fallback de banco e validações de redirect
- `packages/cache` fornece Redis, chaves, locks e Redis Streams

Os snippets antigos abaixo são úteis para entender o racional do módulo, mas os caminhos acima são a referência canônica do código implementado.

### Responsabilidades

- Interceptação de rotas via Next.js Proxy
- Busca otimizada com cache Redis (Cache-Aside Pattern)
- Proteção contra Cache Stampede
- Validação de status do link (ativo, banido, expirado)
- Controle de profundidade de redirects
- Disparo assíncrono de eventos de analytics
- Fallback gracioso quando Redis indisponível

---

## 2. Arquitetura

```
GET /:code
    │
    ▼
┌──────────────────────────────────────┐
│     Next.js Proxy                    │
│   (apps/web/src/proxy.ts)            │
└──────────────────┬───────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │     Route Classifier        │
    │  /:code vs /api/* vs /*     │
    └──────────────┬──────────────┘
                   │ (short code detected)
                   ▼
┌──────────────────────────────────────┐
│  Redirect Route Handler + Domain     │
│ apps/web + packages/redirect-domain  │
└──────────────────┬───────────────────┘
                   │
    ┌──────────────┴──────────────┐
    ▼                             ▼
┌────────────┐             ┌────────────┐
│ Redis L1   │────miss────►│ PostgreSQL │
│ (Bun.redis)│◄───populate─│ (Bun SQL)  │
└──────┬─────┘             └────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│     Validation Pipeline              │
│  isActive → !isBanned → !expired     │
│  → clicks < max → depth < 3          │
└──────────────────┬───────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌────────────┐          ┌────────────┐
│ Redis      │          │ Response   │
│ Streams    │          │ 301/302    │
│ (async)    │          └────────────┘
└────────────┘
```

---

## 3. Estrutura de Diretórios

```
apps/web/
├── src/proxy.ts                      # Classificador Edge + rewrite para /r/{code}
└── src/app/r/[code]/route.ts         # Handler Node.js do redirect HTTP

packages/redirect-domain/
├── src/service.ts                    # Orquestra resolução de redirect
├── src/fetcher.ts                    # Cache-aside + fallback DB
├── src/validator.ts                  # Regras de status/expiração/senha/depth
└── src/url-builder.ts                # URL final + redirect type

packages/cache/
├── src/client.ts                     # Redis client
├── src/keys.ts                       # Cache keys e TTLs
├── src/distributed-lock.ts           # Stampede protection
└── src/stream.ts                     # Redis Streams analytics

packages/contracts/
└── src/redirect.types.ts             # Tipos compartilhados do domínio
```

---

## 4. Next.js Proxy

### 4.1 Configuração Principal

O proxy real está em `apps/web/src/proxy.ts` e hoje faz três coisas principais:

- ignora rotas internas/estáticas e rotas de sistema (`/api`, `/auth`, `/admin`, `/r`, `_next`)
- aplica i18n e CSP nonce para páginas localizadas
- detecta short codes válidos (`3–20` caracteres) e reescreve para `apps/web/src/app/r/[code]/route.ts`

O redirect não é mais executado via `middleware()` chamando um serviço HTTP interno. O proxy apenas classifica a rota; a resolução do código acontece no handler Node.js e no pacote `@urlfy/redirect-domain`.

---

## 5. Redirect Service

### 5.1 Tipos

```typescript
// src/types/redirect.types.ts
export interface CachedLink {
  id: string;
  originalUrl: string;
  redirectType: 301 | 302;
  isActive: boolean;
  isBanned: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  clicksCount: number;
  passwordHash: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export interface RedirectResult {
  success: boolean;
  url?: string;
  redirectType?: 301 | 302;
  error?: RedirectError;
}

export type RedirectError =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'BANNED'
  | 'INACTIVE'
  | 'MAX_CLICKS'
  | 'PASSWORD_REQUIRED'
  | 'REDIRECT_LOOP';
```

### 5.2 Serviço Principal

```typescript
// packages/redirect-domain/src/service.ts
import { redis } from '@/server/lib/redis';
import { db } from '@/db';
import { links } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { acquireLock, releaseLock } from '@/server/lib/distributed-lock';
import { withCircuitBreaker } from '@/server/lib/circuit-breaker';
import type { CachedLink, RedirectResult } from '@/types/redirect.types';

const CACHE_TTL = 3600; // 1 hora
const NEGATIVE_CACHE_TTL = 300; // 5 minutos
const LOCK_TTL = 5000; // 5 segundos

export class RedirectService {
  /**
   * Resolve um short code para URL de destino
   */
  async resolve(code: string, currentDepth: number): Promise<RedirectResult> {
    // 1. Verifica profundidade de redirect
    if (currentDepth >= 3) {
      return { success: false, error: 'REDIRECT_LOOP' };
    }

    // 2. Busca link (cache-first)
    const link = await this.getLink(code);

    if (!link) {
      return { success: false, error: 'NOT_FOUND' };
    }

    // 3. Validações de status
    const validation = this.validateLink(link);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 4. Monta URL final com UTMs
    const finalUrl = this.buildFinalUrl(link);

    return {
      success: true,
      url: finalUrl,
      redirectType: link.redirectType
    };
  }

  /**
   * Busca link com estratégia Cache-Aside
   */
  private async getLink(code: string): Promise<CachedLink | null> {
    try {
      // L1: Verifica cache negativo
      const is404 = await redis.get(`link:404:${code}`);
      if (is404) return null;

      // L2: Verifica cache positivo
      const cached = await redis.get(`link:${code}`);
      if (cached) return JSON.parse(cached);

      // L3: Cache miss - busca com proteção stampede
      return await this.fetchWithStampedeProtection(code);
    } catch (error) {
      // Fallback: busca direto no banco
      console.error('[Redirect] Cache error, falling back to DB:', error);
      return this.fetchFromDatabase(code);
    }
  }

  /**
   * Proteção contra Cache Stampede
   */
  private async fetchWithStampedeProtection(
    code: string
  ): Promise<CachedLink | null> {
    const lockKey = `lock:link:${code}`;
    const acquired = await acquireLock(lockKey, LOCK_TTL);

    if (acquired) {
      try {
        const link = await this.fetchFromDatabase(code);

        if (link) {
          await redis.set(
            `link:${code}`,
            JSON.stringify(link),
            'EX',
            CACHE_TTL
          );
        } else {
          await redis.set(`link:404:${code}`, '1', 'EX', NEGATIVE_CACHE_TTL);
        }

        return link;
      } finally {
        await releaseLock(lockKey);
      }
    } else {
      // Outro processo está populando - aguarda
      await Bun.sleep(50);
      const cached = await redis.get(`link:${code}`);
      return cached ? JSON.parse(cached) : null;
    }
  }

  /**
   * Busca no PostgreSQL com Circuit Breaker
   */
  private async fetchFromDatabase(code: string): Promise<CachedLink | null> {
    return withCircuitBreaker('postgres', async () => {
      const link = await db.query.links.findFirst({
        where: eq(links.shortCode, code),
        columns: {
          id: true,
          originalUrl: true,
          redirectType: true,
          isActive: true,
          isBanned: true,
          expiresAt: true,
          maxClicks: true,
          clicksCount: true,
          passwordHash: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true
        }
      });

      if (!link || link.deletedAt) return null;

      return {
        ...link,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        passwordHash: link.passwordHash ?? null
      } as CachedLink;
    });
  }

  /**
   * Validações de status do link
   */
  private validateLink(link: CachedLink): {
    valid: boolean;
    error?: RedirectError;
  } {
    if (!link.isActive) {
      return { valid: false, error: 'INACTIVE' };
    }

    if (link.isBanned) {
      return { valid: false, error: 'BANNED' };
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { valid: false, error: 'EXPIRED' };
    }

    if (link.maxClicks && link.clicksCount >= link.maxClicks) {
      return { valid: false, error: 'MAX_CLICKS' };
    }

    if (link.passwordHash) {
      return { valid: false, error: 'PASSWORD_REQUIRED' };
    }

    return { valid: true };
  }

  /**
   * Monta URL final com parâmetros UTM
   */
  private buildFinalUrl(link: CachedLink): string {
    const url = new URL(link.originalUrl);

    if (link.utmSource) url.searchParams.set('utm_source', link.utmSource);
    if (link.utmMedium) url.searchParams.set('utm_medium', link.utmMedium);
    if (link.utmCampaign)
      url.searchParams.set('utm_campaign', link.utmCampaign);

    return url.toString();
  }
}

export const redirectService = new RedirectService();
```

---

## 6. Middleware Handler

```typescript
// apps/web/src/app/r/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redirectService } from '@/server/services/redirect.service';
import { analyticsQueue } from '@/server/lib/queue';
import { verify } from 'jsonwebtoken';

export async function handleRedirect(
  request: NextRequest,
  shortCode: string
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  // Extrai profundidade atual
  const currentDepth = parseInt(request.headers.get('X-Redirect-Depth') ?? '0');

  // Resolve o link
  const result = await redirectService.resolve(shortCode, currentDepth);

  if (!result.success) {
    return handleError(result.error!, shortCode, request, requestId);
  }

  // Dispara evento de analytics (assíncrono)
  await enqueueClickEvent(shortCode, request, requestId);

  // Log de latência
  const latency = performance.now() - startTime;
  console.log(
    `[Redirect] ${shortCode} → ${result.redirectType} in ${latency.toFixed(
      2
    )}ms`
  );

  // Resposta de redirect
  return NextResponse.redirect(result.url!, {
    status: result.redirectType,
    headers: {
      'X-Request-Id': requestId,
      'X-Redirect-Depth': String(currentDepth + 1),
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

async function handleError(
  error: string,
  code: string,
  request: NextRequest,
  requestId: string
): Promise<NextResponse> {
  const baseUrl = request.nextUrl.origin;

  switch (error) {
    case 'NOT_FOUND':
      return NextResponse.redirect(`${baseUrl}/404`, {
        status: 302,
        headers: { 'X-Request-Id': requestId }
      });

    case 'PASSWORD_REQUIRED':
      return NextResponse.redirect(`${baseUrl}/unlock/${code}`, {
        status: 302,
        headers: { 'X-Request-Id': requestId }
      });

    case 'EXPIRED':
      return new NextResponse(null, {
        status: 410,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_EXPIRED'
        }
      });

    case 'BANNED':
      return new NextResponse(null, {
        status: 451,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_BANNED'
        }
      });

    case 'REDIRECT_LOOP':
      return new NextResponse(null, {
        status: 421,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'REDIRECT_LOOP'
        }
      });

    default:
      return new NextResponse(null, {
        status: 500,
        headers: { 'X-Request-Id': requestId }
      });
  }
}

async function enqueueClickEvent(
  shortCode: string,
  request: NextRequest,
  requestId: string
): Promise<void> {
  try {
    await analyticsQueue.add(
      'click',
      {
        shortCode,
        requestId,
        ip: request.ip ?? request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        acceptLanguage: request.headers.get('accept-language'),
        timestamp: new Date().toISOString()
      },
      { removeOnComplete: true, attempts: 3 }
    );
  } catch (error) {
    // Log mas não bloqueia o redirect
    console.error('[Redirect] Failed to enqueue click:', error);
  }
}
```

---

## 7. Circuit Breaker

```typescript
// src/server/lib/circuit-breaker.ts
import CircuitBreaker from 'opossum';

const breakers = new Map<string, CircuitBreaker>();

const defaultOptions = {
  timeout: 3000, // 3s timeout
  errorThresholdPercentage: 50, // 50% falhas
  resetTimeout: 30000, // 30s para tentar novamente
  volumeThreshold: 10 // Mínimo 10 requests antes de avaliar
};

export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  let breaker = breakers.get(name);

  if (!breaker) {
    breaker = new CircuitBreaker(fn, defaultOptions);

    breaker.on('open', () => {
      console.warn(`[CircuitBreaker] ${name} OPEN`);
      // Enviar alerta para SigNoz
    });

    breaker.on('halfOpen', () => {
      console.info(`[CircuitBreaker] ${name} HALF-OPEN`);
    });

    breaker.on('close', () => {
      console.info(`[CircuitBreaker] ${name} CLOSED`);
    });

    breakers.set(name, breaker);
  }

  return breaker.fire() as Promise<T>;
}

export function getCircuitState(name: string): string {
  return breakers.get(name)?.status.name ?? 'unknown';
}
```

---

## 8. Distributed Lock

```typescript
// src/server/lib/distributed-lock.ts
import { redis } from './redis';

export async function acquireLock(
  key: string,
  ttlMs: number
): Promise<boolean> {
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
```

---

## 9. Graceful Degradation

Quando Redis está indisponível:

```typescript
// packages/redirect-domain/src/fetcher.ts (fallback Redis -> DB)
private async getLink(code: string): Promise<CachedLink | null> {
  try {
    // Tenta usar Redis
    return await this.getLinkFromCache(code);
  } catch (error) {
    // Redis indisponível - fallback para DB
    console.warn('[Redirect] Redis unavailable, using DB fallback');

    // Emite métrica para alertas
    metrics.increment('redirect.redis_fallback');

    return this.fetchFromDatabase(code);
  }
}
```

---

## 10. Verificação de Senha

Para links protegidos, verificação via cookie JWT:

```typescript
// apps/web/src/app/r/[code]/route.ts (verificação do cookie unlock)
function checkPasswordCookie(request: NextRequest, code: string): boolean {
  const cookieName = `urlfy_unlock_${code}`;
  const token = request.cookies.get(cookieName)?.value;

  if (!token) return false;

  try {
    const payload = verify(token, process.env.JWT_SECRET!) as {
      code: string;
      type: string;
    };
    return payload.code === code && payload.type === 'unlock';
  } catch {
    return false;
  }
}
```

---

## 11. Testes

### 11.1 Testes Unitários

```typescript
// packages/redirect-domain/src/__tests__/service.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { RedirectService } from '../redirect.service';

describe('RedirectService', () => {
  describe('resolve', () => {
    it('should return URL for valid active link', async () => {
      const service = new RedirectService();
      // ... mock redis and db
      const result = await service.resolve('abc123', 0);
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it('should return REDIRECT_LOOP when depth >= 3', async () => {
      const service = new RedirectService();
      const result = await service.resolve('abc123', 3);
      expect(result.error).toBe('REDIRECT_LOOP');
    });

    it('should return EXPIRED for expired links', async () => {
      // ... test implementation
    });
  });
});
```

### 11.2 Testes de Carga (k6)

```javascript
// load/k6/redirect-hot-path.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 5000 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(50)<30', 'p(99)<300'],
    http_req_failed: ['rate<0.01']
  }
};

export default function () {
  const res = http.get('http://localhost:3000/abc123', {
    redirects: 0
  });

  check(res, {
    'is redirect': (r) => r.status === 301 || r.status === 302,
    'has location': (r) => r.headers['Location'] !== undefined
  });
}
```

---

## 12. Observabilidade (OpenTelemetry)

### 12.1 Configuração de Telemetria

```typescript
// packages/telemetry/src/init.ts
import { trace, metrics, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Inicialização do SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'urlfy-redirect',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    environment: process.env.NODE_ENV
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/traces`
  }),
  metricExporter: new OTLPMetricExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/metrics`
  })
});

sdk.start();

// Tracer e Meter
export const tracer = trace.getTracer('redirect-engine');
export const meter = metrics.getMeter('redirect-engine');

// ═══════════════════════════════════════════════════════════════════
// MÉTRICAS
// ═══════════════════════════════════════════════════════════════════

// Histograma de latência
export const redirectLatency = meter.createHistogram('redirect.latency', {
  description: 'Latência do redirecionamento em ms',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000]
  }
});

// Contadores
export const redirectTotal = meter.createCounter('redirect.total', {
  description: 'Total de redirects processados'
});

export const cacheHits = meter.createCounter('redirect.cache.hits', {
  description: 'Cache hits no Redis'
});

export const cacheMisses = meter.createCounter('redirect.cache.misses', {
  description: 'Cache misses no Redis'
});

export const redisFallbacks = meter.createCounter('redirect.redis.fallbacks', {
  description: 'Fallbacks para PostgreSQL quando Redis indisponível'
});

export const redirectErrors = meter.createCounter('redirect.errors', {
  description: 'Erros no redirecionamento'
});

// Gauges
export const circuitBreakerState = meter.createObservableGauge(
  'redirect.circuit_breaker.state',
  {
    description: 'Estado do circuit breaker (0=closed, 1=half-open, 2=open)'
  }
);

// Cache hit rate (calculado)
export const cacheHitRate = meter.createObservableGauge(
  'redirect.cache.hit_rate',
  {
    description: 'Taxa de cache hit (0-100%)'
  }
);
```

### 12.2 Instrumentação do Redirect Service

```typescript
// packages/redirect-domain/src/service.ts (com telemetria)
import {
  tracer,
  redirectLatency,
  redirectTotal,
  cacheHits,
  cacheMisses,
  redisFallbacks,
  redirectErrors
} from '@/server/lib/telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

export class RedirectService {
  async resolve(code: string, currentDepth: number): Promise<RedirectResult> {
    const startTime = performance.now();

    // Cria span para tracing distribuído
    return tracer.startActiveSpan('redirect.resolve', async (span) => {
      span.setAttributes({
        'redirect.code': code,
        'redirect.depth': currentDepth
      });

      try {
        // Verifica profundidade
        if (currentDepth >= 3) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'REDIRECT_LOOP'
          });
          redirectErrors.add(1, { error_type: 'redirect_loop' });
          return { success: false, error: 'REDIRECT_LOOP' };
        }

        // Busca link com métricas de cache
        const link = await this.getLinkWithMetrics(code, span);

        if (!link) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'NOT_FOUND' });
          redirectErrors.add(1, { error_type: 'not_found' });
          return { success: false, error: 'NOT_FOUND' };
        }

        // Validações
        const validation = this.validateLink(link);
        if (!validation.valid) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: validation.error
          });
          redirectErrors.add(1, {
            error_type: validation.error?.toLowerCase()
          });
          return { success: false, error: validation.error };
        }

        // Sucesso
        const finalUrl = this.buildFinalUrl(link);
        span.setAttributes({
          'redirect.target_url': finalUrl,
          'redirect.type': link.redirectType
        });
        span.setStatus({ code: SpanStatusCode.OK });

        // Métricas de sucesso
        redirectTotal.add(1, {
          redirect_type: String(link.redirectType),
          has_password: String(!!link.passwordHash)
        });

        return {
          success: true,
          url: finalUrl,
          redirectType: link.redirectType
        };
      } finally {
        // Registra latência
        const latency = performance.now() - startTime;
        redirectLatency.record(latency, {
          cache_hit: span.attributes?.['cache.hit'] ?? 'unknown'
        });

        span.end();
      }
    });
  }

  private async getLinkWithMetrics(
    code: string,
    parentSpan: Span
  ): Promise<CachedLink | null> {
    return tracer.startActiveSpan('redirect.cache_lookup', async (span) => {
      try {
        // Tenta cache primeiro
        const cached = await redis.get(`link:${code}`);

        if (cached) {
          cacheHits.add(1);
          span.setAttributes({ 'cache.hit': true, 'cache.source': 'redis' });
          parentSpan.setAttributes({ 'cache.hit': 'true' });
          return JSON.parse(cached);
        }

        // Cache miss
        cacheMisses.add(1);
        span.setAttributes({ 'cache.hit': false });
        parentSpan.setAttributes({ 'cache.hit': 'false' });

        // Busca no DB
        return await this.fetchWithStampedeProtection(code);
      } catch (error) {
        // Redis indisponível - fallback
        redisFallbacks.add(1);
        span.setAttributes({
          'cache.fallback': true,
          'cache.error': String(error)
        });
        return this.fetchFromDatabase(code);
      } finally {
        span.end();
      }
    });
  }
}
```

### 12.3 Dashboard de Métricas (SigNoz)

```yaml
# signoz/dashboards/redirect-engine.json
{
  'title': 'Redirect Engine Dashboard',
  'panels':
    [
      {
        'title': 'Latência P50/P95/P99',
        'type': 'graph',
        'query': 'histogram_quantile(0.99, sum(rate(redirect_latency_bucket[5m])) by (le))'
      },
      {
        'title': 'Throughput (req/s)',
        'type': 'stat',
        'query': 'sum(rate(redirect_total[1m]))'
      },
      {
        'title': 'Cache Hit Rate',
        'type': 'gauge',
        'query': 'sum(rate(redirect_cache_hits[5m])) / (sum(rate(redirect_cache_hits[5m])) + sum(rate(redirect_cache_misses[5m]))) * 100'
      },
      {
        'title': 'Error Rate',
        'type': 'stat',
        'query': 'sum(rate(redirect_errors[5m])) / sum(rate(redirect_total[5m])) * 100'
      },
      {
        'title': 'Erros por Tipo',
        'type': 'piechart',
        'query': 'sum by (error_type) (increase(redirect_errors[1h]))'
      },
      {
        'title': 'Redis Fallbacks',
        'type': 'timeseries',
        'query': 'sum(rate(redirect_redis_fallbacks[5m]))'
      }
    ],
  'alerts':
    [
      {
        'name': 'High Redirect Latency P99',
        'condition': 'histogram_quantile(0.99, redirect_latency) > 300',
        'severity': 'warning'
      },
      {
        'name': 'Low Cache Hit Rate',
        'condition': 'redirect_cache_hit_rate < 70',
        'severity': 'warning'
      },
      {
        'name': 'High Error Rate',
        'condition': 'redirect_error_rate > 1',
        'severity': 'critical'
      },
      {
        'name': 'Circuit Breaker Open',
        'condition': 'redirect_circuit_breaker_state == 2',
        'severity': 'critical'
      }
    ]
}
```

---

## 13. Testes Avançados

### 13.1 Testes Unitários Completos

```typescript
// packages/redirect-domain/src/__tests__/service.test.ts
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { RedirectService } from '../redirect.service';

// Mocks
const mockRedis = {
  get: mock(() => null),
  set: mock(() => 'OK'),
  del: mock(() => 1)
};

const mockDb = {
  query: {
    links: {
      findFirst: mock(() => null)
    }
  }
};

describe('RedirectService', () => {
  let service: RedirectService;

  beforeEach(() => {
    service = new RedirectService();
    // Reset mocks
    mockRedis.get.mockReset();
    mockDb.query.links.findFirst.mockReset();
  });

  describe('resolve()', () => {
    it('should return URL for valid active link from cache', async () => {
      const cachedLink = {
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 301,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 10,
        passwordHash: null
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedLink));

      const result = await service.resolve('abc123', 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.redirectType).toBe(301);
    });

    it('should return REDIRECT_LOOP when depth >= 3', async () => {
      const result = await service.resolve('abc123', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('REDIRECT_LOOP');
    });

    it('should return NOT_FOUND for non-existent code', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.links.findFirst.mockResolvedValue(null);

      const result = await service.resolve('notfound', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });

    it('should return EXPIRED for expired links', async () => {
      const expiredLink = {
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: '2020-01-01T00:00:00Z', // Expirado
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredLink));

      const result = await service.resolve('expired', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('EXPIRED');
    });

    it('should return BANNED for banned links', async () => {
      const bannedLink = {
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: true,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(bannedLink));

      const result = await service.resolve('banned', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('BANNED');
    });

    it('should return MAX_CLICKS when limit reached', async () => {
      const maxClicksLink = {
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: 100,
        clicksCount: 100, // Atingiu limite
        passwordHash: null
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(maxClicksLink));

      const result = await service.resolve('maxed', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MAX_CLICKS');
    });

    it('should return PASSWORD_REQUIRED for protected links', async () => {
      const protectedLink = {
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: '$argon2id$...'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(protectedLink));

      const result = await service.resolve('protected', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('PASSWORD_REQUIRED');
    });

    it('should append UTM parameters to final URL', async () => {
      const linkWithUtm = {
        id: 'uuid-123',
        originalUrl: 'https://example.com/page',
        redirectType: 302,
        isActive: true,
        isBanned: false,
        expiresAt: null,
        maxClicks: null,
        clicksCount: 0,
        passwordHash: null,
        utmSource: 'twitter',
        utmMedium: 'social',
        utmCampaign: 'launch'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(linkWithUtm));

      const result = await service.resolve('withutm', 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain('utm_source=twitter');
      expect(result.url).toContain('utm_medium=social');
      expect(result.url).toContain('utm_campaign=launch');
    });

    it('should fallback to database when Redis fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));
      mockDb.query.links.findFirst.mockResolvedValue({
        id: 'uuid-123',
        originalUrl: 'https://example.com',
        redirectType: 302,
        isActive: true,
        isBanned: false
      });

      const result = await service.resolve('fallback', 0);

      expect(result.success).toBe(true);
      expect(mockDb.query.links.findFirst).toHaveBeenCalled();
    });
  });
});
```

### 13.2 Testes de Carga Avançados (k6)

```javascript
// tests/load/redirect-scenarios.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas customizadas
const redirectLatency = new Trend('redirect_latency');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');
const errorRate = new Rate('error_rate');

// Configuração de cenários
export const options = {
  scenarios: {
    // Cenário 1: Carga constante
    constant_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '2m',
      exec: 'constantLoad'
    },
    // Cenário 2: Rampa de carga
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '1m', target: 0 }
      ],
      exec: 'rampUp',
      startTime: '2m'
    },
    // Cenário 3: Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '10s', target: 2000 },
        { duration: '30s', target: 2000 },
        { duration: '10s', target: 100 }
      ],
      exec: 'spikeTest',
      startTime: '10m'
    },
    // Cenário 4: Soak test (endurance)
    soak: {
      executor: 'constant-vus',
      vus: 200,
      duration: '30m',
      exec: 'soakTest',
      startTime: '12m'
    }
  },
  thresholds: {
    // SLOs do PRD
    'http_req_duration{scenario:constant_load}': ['p(50)<30', 'p(99)<300'],
    'http_req_duration{scenario:ramp_up}': ['p(50)<50', 'p(99)<500'],
    'http_req_duration{scenario:spike}': ['p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    redirect_latency: ['p(50)<30', 'p(99)<300']
  }
};

// Links de teste (pré-criados no ambiente de teste)
const TEST_LINKS = [
  'abc123',
  'def456',
  'ghi789',
  'jkl012',
  'mno345',
  'pqr678',
  'stu901',
  'vwx234',
  'yza567',
  'bcd890'
];

// Funções de cenário
export function constantLoad() {
  const code = TEST_LINKS[Math.floor(Math.random() * TEST_LINKS.length)];
  performRedirect(code);
}

export function rampUp() {
  const code = TEST_LINKS[Math.floor(Math.random() * TEST_LINKS.length)];
  performRedirect(code);
}

export function spikeTest() {
  // Durante spike, foca em um único link (simula viral)
  performRedirect('viral123');
}

export function soakTest() {
  const code = TEST_LINKS[Math.floor(Math.random() * TEST_LINKS.length)];
  performRedirect(code);
  sleep(0.1); // Menor taxa para soak
}

// Função principal de redirect
function performRedirect(code) {
  const startTime = Date.now();

  const res = http.get(`http://localhost:3000/${code}`, {
    redirects: 0, // Não seguir redirects
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'Accept-Language': 'pt-BR,pt;q=0.9'
    }
  });

  const latency = Date.now() - startTime;
  redirectLatency.add(latency);

  // Verifica cache hit via header customizado
  if (res.headers['X-Cache-Status'] === 'HIT') {
    cacheHits.add(1);
  } else {
    cacheMisses.add(1);
  }

  // Validações
  const success = check(res, {
    'is redirect': (r) => r.status === 301 || r.status === 302,
    'has location header': (r) => r.headers['Location'] !== undefined,
    'has request id': (r) => r.headers['X-Request-Id'] !== undefined,
    'latency within SLO': () => latency < 300
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

// Teste de links inexistentes (cache negativo)
export function testNotFound() {
  const res = http.get('http://localhost:3000/nonexistent', {
    redirects: 0
  });

  check(res, {
    'returns 302 to 404 page': (r) => r.status === 302,
    'location is 404': (r) => r.headers['Location']?.includes('/404')
  });
}

// Teste de links protegidos por senha
export function testPasswordProtected() {
  const res = http.get('http://localhost:3000/protected', {
    redirects: 0
  });

  check(res, {
    'redirects to unlock page': (r) => r.status === 302,
    'location is unlock': (r) => r.headers['Location']?.includes('/unlock/')
  });
}
```

### 13.3 Testes de Integração

```typescript
// tests/integration/redirect.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@/db';
import { links } from '@/db/schema';
import { redis } from '@/server/lib/redis';

describe('Redirect Integration', () => {
  const testLink = {
    id: 'test-uuid-001',
    shortCode: 'int-test-1',
    originalUrl: 'https://example.com/integration-test',
    redirectType: 302,
    isActive: true
  };

  beforeAll(async () => {
    // Limpa dados de teste
    await db.delete(links).where(eq(links.shortCode, testLink.shortCode));
    await redis.del(`link:${testLink.shortCode}`);

    // Insere link de teste
    await db.insert(links).values(testLink);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(links).where(eq(links.shortCode, testLink.shortCode));
    await redis.del(`link:${testLink.shortCode}`);
  });

  it('should redirect and populate cache on first request', async () => {
    // Primeiro request (cache miss)
    const res1 = await fetch(`http://localhost:3000/${testLink.shortCode}`, {
      redirect: 'manual'
    });

    expect(res1.status).toBe(302);
    expect(res1.headers.get('Location')).toBe(testLink.originalUrl);

    // Verifica se cache foi populado
    const cached = await redis.get(`link:${testLink.shortCode}`);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!).originalUrl).toBe(testLink.originalUrl);
  });

  it('should serve from cache on subsequent requests', async () => {
    // Segundo request (cache hit)
    const res = await fetch(`http://localhost:3000/${testLink.shortCode}`, {
      redirect: 'manual'
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('X-Cache-Status')).toBe('HIT');
  });

  it('should invalidate cache when link is updated', async () => {
    // Atualiza link
    await db
      .update(links)
      .set({ originalUrl: 'https://example.com/updated' })
      .where(eq(links.shortCode, testLink.shortCode));

    // Invalida cache manualmente (ou via trigger)
    await redis.del(`link:${testLink.shortCode}`);

    // Próximo request deve trazer URL atualizada
    const res = await fetch(`http://localhost:3000/${testLink.shortCode}`, {
      redirect: 'manual'
    });

    expect(res.headers.get('Location')).toBe('https://example.com/updated');
  });
});
```

---

## 14. Métricas e Alertas

| Métrica                    | Tipo      | Alerta            |
| -------------------------- | --------- | ----------------- |
| `redirect.latency`         | Histogram | P99 > 300ms       |
| `redirect.cache.hit_rate`  | Gauge     | < 70%             |
| `redirect.redis.fallbacks` | Counter   | > 10/min          |
| `redirect.circuit_breaker` | Gauge     | state == 2 (open) |
| `redirect.errors`          | Counter   | rate > 1%         |
| `redirect.total`           | Counter   | Para throughput   |

---

## 15. Checklist de Implementação

- [x] Next.js route classifier em `apps/web/src/proxy.ts`
- [x] `@urlfy/redirect-domain` com Cache-Aside
- [x] Distributed Lock (SETNX) em `packages/cache`
- [x] Circuit Breaker para PostgreSQL/Redis
- [x] Graceful Degradation para Redis
- [x] Validação de profundidade (`X-Redirect-Depth`)
- [x] Verificação de senha via cookie JWT
- [x] Enfileiramento assíncrono de clicks via Redis Streams
- [x] Testes unitários e integração para redirect/domain
- [ ] Testes de carga k6
- [x] Métricas OpenTelemetry
- [ ] Alertas SigNoz configurados/documentados fora do repositório
