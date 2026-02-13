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
import { getEnv } from '@/lib/env';

// Only enable telemetry diagnostics for actual errors in development
// INFO level is too verbose and logs stack traces for logger registration
if (
  process.env.NODE_ENV === 'development' &&
  process.env.OTEL_DEBUG === 'true'
) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

// ═══════════════════════════════════════════════════════════════════
// RESOURCE (Identificação do Serviço)
// ═══════════════════════════════════════════════════════════════════

const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

// ═══════════════════════════════════════════════════════════════════
// EXPORTERS (OTLP/HTTP Protocol - requires /v1/ prefix)
// @see https://opentelemetry.io/docs/specs/otlp/#otlphttp
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// LOGGER PROVIDER
// ═══════════════════════════════════════════════════════════════════

const loggerProvider = new LoggerProvider({ resource });
// Generic type to allow access to addLogRecordProcessor
type LoggerProviderWithProcessor = LoggerProvider & {
  addLogRecordProcessor: (processor: BatchLogRecordProcessor) => void;
};

// ═══════════════════════════════════════════════════════════════════
// SDK NODE (only with exporters if telemetry is enabled)
// ═══════════════════════════════════════════════════════════════════

let sdk: NodeSDK | null = null;
let telemetryInitialized = false;
let logProcessorConfigured = false;
let telemetryShuttingDown = false;

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export function initTelemetry() {
  if (telemetryInitialized) {
    console.log('[Telemetry] Already initialized. Skipping re-initialization.');
    return;
  }

  const env = getEnv();

  if (!env.TELEMETRY_ENABLED) {
    console.log('[Telemetry] Disabled (TELEMETRY_ENABLED=false)');
    telemetryInitialized = true;
    return;
  }

  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.warn(
      '[Telemetry] Enabled but OTEL_EXPORTER_OTLP_ENDPOINT not set. Skipping initialization.'
    );
    telemetryInitialized = true;
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
  });

  const logExporter = new OTLPLogExporter({
    url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
  });

  if (!logProcessorConfigured && 'addLogRecordProcessor' in loggerProvider) {
    (
      loggerProvider as unknown as LoggerProviderWithProcessor
    ).addLogRecordProcessor(
      new BatchLogRecordProcessor(logExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 10000
      })
    );

    logProcessorConfigured = true;
  }

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000 // 1 minuto
      })
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false // Reduz ruído
        }
      })
    ]
  });

  sdk.start();
  telemetryInitialized = true;
  telemetryShuttingDown = false;

  console.log(
    `[Telemetry] ✅ Initialized with endpoint: ${env.OTEL_EXPORTER_OTLP_ENDPOINT}`
  );
  console.log(
    `[Telemetry] Service: ${process.env.OTEL_SERVICE_NAME || 'urlfy-api'}`
  );

  const bootstrapLogger = loggerProvider.getLogger('telemetry-bootstrap');
  bootstrapLogger.emit({
    severityText: 'INFO',
    body: JSON.stringify({
      message: 'Telemetry logger pipeline initialized',
      timestamp: new Date().toISOString(),
      logger: 'telemetry-bootstrap'
    }),
    attributes: {
      logger: 'telemetry-bootstrap',
      event: 'telemetry.init',
      service: process.env.OTEL_SERVICE_NAME || 'urlfy-api'
    }
  });

  void loggerProvider.forceFlush().catch(() => {
    // Best effort: telemetry should never crash app startup
  });
}

export async function shutdownTelemetry() {
  try {
    if (!telemetryInitialized || !sdk) return;
    if (telemetryShuttingDown) return;

    telemetryShuttingDown = true;

    await loggerProvider.forceFlush();
    await loggerProvider.shutdown();
    await sdk.shutdown();

    sdk = null;
    telemetryInitialized = false;
    telemetryShuttingDown = false;

    console.log('✅ OpenTelemetry shut down gracefully');
  } catch (error) {
    telemetryShuttingDown = false;
    console.error('❌ Error shutting down OpenTelemetry:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LOGGER ESTRUTURADO
// ═══════════════════════════════════════════════════════════════════

import { type Attributes, trace } from '@opentelemetry/api';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

export type Logger = ReturnType<typeof createLogger>;

function normalizeAttributeValue(
  value: unknown
): string | number | boolean | string[] | number[] | boolean[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string')) {
      return value;
    }
    if (value.every((item) => typeof item === 'number')) {
      return value;
    }
    if (value.every((item) => typeof item === 'boolean')) {
      return value;
    }

    return [JSON.stringify(value)];
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toOtelAttributes(
  data: Record<string, unknown>
): Record<string, string | number | boolean | string[] | number[] | boolean[]> {
  const attributes: Record<
    string,
    string | number | boolean | string[] | number[] | boolean[]
  > = {};

  for (const [key, value] of Object.entries(data)) {
    const normalized = normalizeAttributeValue(value);
    if (normalized !== undefined) {
      attributes[key] = normalized;
    }
  }

  return attributes;
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
    const attributes = toOtelAttributes(logRecord) as unknown as Attributes;

    try {
      logger.emit({
        severityText: level.toUpperCase(),
        body: JSON.stringify(logRecord),
        attributes
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Telemetry] Failed to emit log record', {
          error: error instanceof Error ? error.message : String(error),
          logger: name,
          level,
          message
        });
      }
    }

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

/**
 * Record a cache hit with OTel counter + local tracker for hit rate gauge.
 * Use this instead of `cacheHits.add()` directly.
 */
export function recordCacheHit(
  value = 1,
  attributes?: Record<string, string>
): void {
  cacheMetricsTracker.recordHit();
  cacheHits.add(value, attributes);
}

/**
 * Record a cache miss with OTel counter + local tracker for hit rate gauge.
 * Use this instead of `cacheMisses.add()` directly.
 */
export function recordCacheMiss(
  value = 1,
  attributes?: Record<string, string>
): void {
  cacheMetricsTracker.recordMiss();
  cacheMisses.add(value, attributes);
}

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
