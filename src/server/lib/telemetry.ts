// src/server/lib/telemetry.ts
/**
 * Full OpenTelemetry instrumentation for Node.js runtime
 *
 * ⚠️ WARNING: DO NOT import this file in proxy.ts or Middleware code!
 *
 * This module uses Node.js-specific APIs that are not available in Middleware.
 * For middleware, use telemetry.edge.ts instead.
 *
 * Usage:
 * - API routes (app/api/*)
 * - Server actions
 * - Background workers
 * - CLI scripts
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider
} from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions';

// Only enable telemetry diagnostics for actual errors in development
// INFO level is too verbose and logs stack traces for logger registration
if (
  process.env.NODE_ENV === 'development' &&
  process.env.OTEL_DEBUG === 'true'
) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// Check if telemetry is enabled (requires explicit OTEL endpoint or OTEL_ENABLED=true)
const TELEMETRY_ENABLED =
  process.env.OTEL_ENABLED === 'true' || Boolean(OTEL_ENDPOINT);

// Fallback to localhost if endpoint not set but telemetry is explicitly enabled
const OTEL_ENDPOINT_URL = OTEL_ENDPOINT || 'http://localhost:4318';

// ═══════════════════════════════════════════════════════════════════
// RESOURCE (Identificação do Serviço)
// ═══════════════════════════════════════════════════════════════════

const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

// ═══════════════════════════════════════════════════════════════════
// EXPORTERS (only created if telemetry is enabled)
// ═══════════════════════════════════════════════════════════════════

const traceExporter = TELEMETRY_ENABLED
  ? new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT_URL}/traces`
    })
  : undefined;

const metricExporter = TELEMETRY_ENABLED
  ? new OTLPMetricExporter({
      url: `${OTEL_ENDPOINT_URL}/metrics`
    })
  : undefined;

const logExporter = TELEMETRY_ENABLED
  ? new OTLPLogExporter({
      url: `${OTEL_ENDPOINT_URL}/logs`
    })
  : undefined;

// ═══════════════════════════════════════════════════════════════════
// LOGGER PROVIDER
// ═══════════════════════════════════════════════════════════════════

const loggerProvider = new LoggerProvider({ resource });
if (logExporter && 'addLogRecordProcessor' in loggerProvider) {
  // biome-ignore lint/suspicious/noExplicitAny: API compatibility with OpenTelemetry SDK versions
  (loggerProvider as any).addLogRecordProcessor(
    new BatchLogRecordProcessor(logExporter)
  );
}

// ═══════════════════════════════════════════════════════════════════
// SDK NODE (only with exporters if telemetry is enabled)
// ═══════════════════════════════════════════════════════════════════

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReaders: metricExporter
    ? [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 60000 // 1 minuto
        })
      ]
    : [],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false // Reduz ruído
      }
    })
  ]
});

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

export function initTelemetry() {
  sdk.start();
  if (TELEMETRY_ENABLED) {
    console.log(`✅ Telemetry initialized (exporting to ${OTEL_ENDPOINT_URL})`);
  } else {
    console.log(
      '✅ Telemetry initialized (local only - no OTEL_EXPORTER_OTLP_ENDPOINT set)'
    );
  }
}

export async function shutdownTelemetry() {
  try {
    await sdk.shutdown();
    console.log('✅ OpenTelemetry shut down gracefully');
  } catch (error) {
    console.error('❌ Error shutting down OpenTelemetry:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LOGGER ESTRUTURADO
// ═══════════════════════════════════════════════════════════════════

import { trace } from '@opentelemetry/api';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

export function createLogger(name: string) {
  const logger = loggerProvider.getLogger(name);

  const log = (level: string, message: string, ctx?: LogContext) => {
    // Safely get active span (may not exist in test environment)
    const span =
      typeof trace?.getActiveSpan === 'function'
        ? trace.getActiveSpan()
        : undefined;
    const spanContext = span?.spanContext();

    const logRecord: Record<string, unknown> = {
      level,
      message,
      timestamp: new Date().toISOString(),
      logger: name,
      ...ctx
    };

    if (spanContext) {
      logRecord.traceId = spanContext.traceId;
      logRecord.spanId = spanContext.spanId;
    }

    // Emite log estruturado
    logger.emit({
      severityText: level.toUpperCase(),
      body: JSON.stringify(logRecord),
      // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry attributes accept flexible types
      attributes: logRecord as any
    });

    // Console log para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logRecord, null, 2));
    }
  };

  return {
    debug: (message: string, ctx?: LogContext) => log('debug', message, ctx),
    info: (message: string, ctx?: LogContext) => log('info', message, ctx),
    warn: (message: string, ctx?: LogContext) => log('warn', message, ctx),
    error: (message: string, ctx?: LogContext) => log('error', message, ctx)
  };
}

// ═══════════════════════════════════════════════════════════════════
// METRICS (Redirect Engine)
// ═══════════════════════════════════════════════════════════════════

import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('urlfy-redirect', '1.0.0');

/**
 * Histograma de latência de redirect (em milissegundos)
 */
export const redirectLatency = meter.createHistogram('redirect.latency', {
  description: 'Latência do redirecionamento em milissegundos',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2000]
  }
});

/**
 * Contador total de redirects processados
 */
export const redirectTotal = meter.createCounter('redirect.total', {
  description: 'Total de redirects processados',
  unit: '1'
});

/**
 * Cache hits
 */
export const cacheHits = meter.createCounter('redirect.cache.hits', {
  description: 'Cache hits no Redis',
  unit: '1'
});

/**
 * Cache misses
 */
export const cacheMisses = meter.createCounter('redirect.cache.misses', {
  description: 'Cache misses no Redis',
  unit: '1'
});

/**
 * Fallbacks para PostgreSQL quando Redis está indisponível
 */
export const redisFallbacks = meter.createCounter('redirect.redis.fallbacks', {
  description: 'Fallbacks para PostgreSQL quando Redis indisponível',
  unit: '1'
});

/**
 * Erros de redirect por tipo
 */
export const redirectErrors = meter.createCounter('redirect.errors', {
  description: 'Erros no redirecionamento por tipo',
  unit: '1'
});

/**
 * Stampede protection locks adquiridos
 */
export const stampedeLocksAcquired = meter.createCounter(
  'redirect.stampede.locks_acquired',
  {
    description: 'Locks adquiridos para stampede protection',
    unit: '1'
  }
);

/**
 * Stampede protection locks aguardados
 */
export const stampedeLocksWaited = meter.createCounter(
  'redirect.stampede.locks_waited',
  {
    description: 'Requests que aguardaram lock de outro processo',
    unit: '1'
  }
);

/**
 * Circuit breaker trips (transições para OPEN)
 */
export const circuitBreakerTrips = meter.createCounter(
  'redirect.circuit_breaker.trips',
  {
    description: 'Número de vezes que o circuit breaker abriu',
    unit: '1'
  }
);

/**
 * Gauge observável para taxa de cache hit
 * Calculado dinamicamente a partir dos contadores internos
 */
class CacheMetricsTracker {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

const cacheMetricsTracker = new CacheMetricsTracker();

// Create wrapper functions that track metrics
const originalCacheHitsAdd = cacheHits.add.bind(cacheHits);
const originalCacheMissesAdd = cacheMisses.add.bind(cacheMisses);

// Override add methods to track locally
// biome-ignore lint/suspicious/noExplicitAny: Required to override OpenTelemetry Counter method
(cacheHits as any).add = (
  value: number,
  attributes?: Record<string, string>
) => {
  cacheMetricsTracker.recordHit();
  return originalCacheHitsAdd(value, attributes);
};

// biome-ignore lint/suspicious/noExplicitAny: Required to override OpenTelemetry Counter method
(cacheMisses as any).add = (
  value: number,
  attributes?: Record<string, string>
) => {
  cacheMetricsTracker.recordMiss();
  return originalCacheMissesAdd(value, attributes);
};

/**
 * Observable gauge for cache hit rate
 * Auto-calculates from tracked hits/misses
 */
export const cacheHitRate = meter.createObservableGauge(
  'redirect.cache.hit_rate',
  {
    description: 'Taxa de cache hit calculada (0-100%)',
    unit: '%'
  }
);

cacheHitRate.addCallback((result) => {
  result.observe(cacheMetricsTracker.getHitRate());
});

/**
 * Helper para registrar métricas de redirect completas
 */
export function recordRedirectMetrics(metrics: {
  latencyMs: number;
  success: boolean;
  cacheHit: boolean;
  errorType?: string;
}): void {
  // Latência (Histograms use .record() not .add())
  redirectLatency.record(metrics.latencyMs);

  // Total
  redirectTotal.add(1, {
    success: String(metrics.success),
    cacheHit: String(metrics.cacheHit)
  });

  // Erros
  if (!metrics.success && metrics.errorType) {
    redirectErrors.add(1, {
      type: metrics.errorType
    });
  }
}

/**
 * Reseta estatísticas de cache (útil para testes)
 */
export function resetCacheMetrics(): void {
  cacheMetricsTracker.reset();
}
