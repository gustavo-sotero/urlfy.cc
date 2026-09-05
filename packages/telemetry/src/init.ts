// src/server/lib/telemetry/init.ts
/**
 * OpenTelemetry SDK initialization for Node.js runtime.
 *
 * WARNING: DO NOT import this file in proxy.ts or Middleware code!
 * This module uses Node.js-specific APIs not available in Edge/Middleware.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { configure, getConsoleSink, type Sink } from '@logtape/logtape';
import { getOpenTelemetrySink } from '@logtape/otel';
import { DEFAULT_REDACT_FIELDS, redactByField } from '@logtape/redaction';
import {
  context,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  metrics,
  propagation,
  trace
} from '@opentelemetry/api';
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

/** Read typed telemetry env vars directly – no Zod dependency in this package */
function getTelemetryEnv() {
  return {
    TELEMETRY_ENABLED: process.env.TELEMETRY_ENABLED === 'true',
    // Base endpoint: trailing slashes are normalized before signal path append.
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '',
    // Per-signal endpoint overrides: used as-is when set (no suffix appended).
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || '',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || '',
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '',
    // Shared headers for all OTLP exporters (format: "key1=value1,key2=value2").
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS || '',
    // Per-signal headers override shared headers with the same key.
    OTEL_EXPORTER_OTLP_LOGS_HEADERS:
      process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS || '',
    OTEL_EXPORTER_OTLP_METRICS_HEADERS:
      process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS || '',
    OTEL_EXPORTER_OTLP_TRACES_HEADERS:
      process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS || '',
    // Service version: standard env takes priority over npm package version.
    OTEL_SERVICE_VERSION:
      process.env.OTEL_SERVICE_VERSION ||
      process.env.npm_package_version ||
      '0.1.0'
  };
}

/**
 * Normalize a base OTLP endpoint by trimming whitespace and removing trailing slashes.
 *
 * Example:
 *   'https://collector.urlfy.cc/'  → 'https://collector.urlfy.cc'
 *   'http://localhost:4318/'       → 'http://localhost:4318'
 *
 * @internal exported for unit testing only
 */
export function normalizeBaseEndpoint(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/**
 * Detect when a base endpoint is misconfigured with a signal-specific OTLP path.
 * The base OTLP endpoint must not end with /v1/logs, /v1/metrics, or /v1/traces.
 *
 * @internal exported for unit testing only
 */
export function isSignalEndpointBase(base: string): boolean {
  return /\/v1\/(logs|metrics|traces)$/.test(normalizeBaseEndpoint(base));
}

/**
 * Resolve the effective OTLP signal endpoint.
 *
 * Priority:
 *   1. Per-signal override (e.g. OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) — used as-is.
 *   2. Normalized base endpoint with signal suffix appended.
 *   3. Undefined when neither the per-signal override nor base endpoint is set.
 *
 * Per-signal overrides are assumed to be full path URLs pointing directly at the
 * signal receiver. No suffix is added. Base endpoint is normalized to strip trailing
 * slashes before suffix append so 'https://collector.urlfy.cc/' correctly becomes
 * 'https://collector.urlfy.cc/v1/logs' rather than 'https://collector.urlfy.cc//v1/logs'.
 *
 * @internal exported for unit testing only
 */
export function resolveSignalEndpoint(
  base: string,
  signalOverride: string,
  suffix: '/v1/logs' | '/v1/metrics' | '/v1/traces'
): string | undefined {
  const trimmedOverride = signalOverride.trim();
  if (trimmedOverride) return trimmedOverride;

  const normalizedBase = normalizeBaseEndpoint(base);
  if (!normalizedBase) return undefined;

  return `${normalizedBase}${suffix}`;
}

/**
 * Parse OTEL_EXPORTER_OTLP_HEADERS into a Record<string, string>.
 * Standard format: "key1=value1,key2=value2"
 * Returns an empty object if the raw string is empty.
 *
 * @internal exported for unit testing only
 */
export function parseOtlpHeaders(raw: string): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      result[trimmed] = '';
    } else {
      result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return result;
}

/**
 * Resolve effective OTLP headers for a signal by merging shared headers with
 * signal-specific headers. Signal-specific keys take precedence.
 *
 * @internal exported for unit testing only
 */
export function resolveSignalHeaders(
  sharedRaw: string,
  signalRaw: string
): Record<string, string> {
  return {
    ...parseOtlpHeaders(sharedRaw),
    ...parseOtlpHeaders(signalRaw)
  };
}

// Only enable telemetry diagnostics for actual errors in development
// INFO level is too verbose and logs stack traces for logger registration
if (
  process.env.NODE_ENV === 'development' &&
  process.env.OTEL_DEBUG === 'true'
) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

// ═══════════════════════════════════════════════════════════════════
// RESOURCE (Service Identification)
// ═══════════════════════════════════════════════════════════════════

const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
  [SEMRESATTRS_SERVICE_VERSION]:
    process.env.OTEL_SERVICE_VERSION ||
    process.env.npm_package_version ||
    '0.1.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

function createLoggerProvider() {
  return new LoggerProvider({ resource });
}

// ═══════════════════════════════════════════════════════════════════
// LOGGER PROVIDER
// ═══════════════════════════════════════════════════════════════════

export let loggerProvider = createLoggerProvider();

// Generic type to allow access to addLogRecordProcessor
type LoggerProviderWithProcessor = LoggerProvider & {
  addLogRecordProcessor: (processor: BatchLogRecordProcessor) => void;
};

// ═══════════════════════════════════════════════════════════════════
// SDK STATE
// ═══════════════════════════════════════════════════════════════════

let sdk: NodeSDK | null = null;
let telemetryInitialized = false;
let logProcessorConfigured = false;
let telemetryShuttingDown = false;
let loggingConfigured = false;
let telemetryStartupPromise: Promise<void> = Promise.resolve();
let telemetryBootstrapPromise: Promise<void> = Promise.resolve();
let telemetryStartupSucceeded = false;

function writeBootstrap(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
) {
  const line = JSON.stringify({
    level,
    message,
    logger: 'telemetry-bootstrap',
    timestamp: new Date().toISOString(),
    ...context
  });

  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export function initTelemetry() {
  if (telemetryInitialized) {
    writeBootstrap('info', 'Telemetry already initialized; skipping');
    return;
  }

  const env = getTelemetryEnv();

  if (!env.TELEMETRY_ENABLED) {
    writeBootstrap('info', 'Telemetry disabled', {
      reason: 'TELEMETRY_ENABLED=false'
    });
    telemetryInitialized = true;
    return;
  }

  const hasAnyEndpoint =
    !!env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    !!env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
    !!env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
    !!env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

  if (!hasAnyEndpoint) {
    writeBootstrap(
      'warn',
      'Telemetry enabled but no OTLP endpoint configured',
      {
        reason:
          'Set OTEL_EXPORTER_OTLP_ENDPOINT or per-signal endpoint env vars'
      }
    );
    telemetryInitialized = true;
    return;
  }

  if (
    env.OTEL_EXPORTER_OTLP_ENDPOINT &&
    isSignalEndpointBase(env.OTEL_EXPORTER_OTLP_ENDPOINT)
  ) {
    writeBootstrap(
      'warn',
      'OTLP base endpoint appears to include a signal path',
      {
        configuredBase: normalizeBaseEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT),
        reason:
          'Use the collector base URL without /v1/logs, /v1/metrics, or /v1/traces'
      }
    );
  }

  const traceHeaders = resolveSignalHeaders(
    env.OTEL_EXPORTER_OTLP_HEADERS,
    env.OTEL_EXPORTER_OTLP_TRACES_HEADERS
  );
  const metricHeaders = resolveSignalHeaders(
    env.OTEL_EXPORTER_OTLP_HEADERS,
    env.OTEL_EXPORTER_OTLP_METRICS_HEADERS
  );
  const logHeaders = resolveSignalHeaders(
    env.OTEL_EXPORTER_OTLP_HEADERS,
    env.OTEL_EXPORTER_OTLP_LOGS_HEADERS
  );

  const traceHeaderCount = Object.keys(traceHeaders).length;
  const metricHeaderCount = Object.keys(metricHeaders).length;
  const logHeaderCount = Object.keys(logHeaders).length;

  const tracesEndpoint = resolveSignalEndpoint(
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    '/v1/traces'
  );
  const metricsEndpoint = resolveSignalEndpoint(
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
    env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    '/v1/metrics'
  );
  const logsEndpoint = resolveSignalEndpoint(
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
    env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    '/v1/logs'
  );

  writeBootstrap('info', 'Resolved OTLP signal endpoints', {
    traces: tracesEndpoint ?? 'disabled',
    metrics: metricsEndpoint ?? 'disabled',
    logs: logsEndpoint ?? 'disabled',
    headers:
      traceHeaderCount === 0 && metricHeaderCount === 0 && logHeaderCount === 0
        ? 'none'
        : `traces=${traceHeaderCount}, metrics=${metricHeaderCount}, logs=${logHeaderCount}`
  });

  const traceExporter = tracesEndpoint
    ? new OTLPTraceExporter({
        url: tracesEndpoint,
        ...(traceHeaderCount > 0 ? { headers: traceHeaders } : {})
      })
    : undefined;

  const metricReader = metricsEndpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: metricsEndpoint,
          ...(metricHeaderCount > 0 ? { headers: metricHeaders } : {})
        }),
        exportIntervalMillis:
          process.env.NODE_ENV === 'development' ? 10000 : 60000
      })
    : undefined;

  const logExporter = logsEndpoint
    ? new OTLPLogExporter({
        url: logsEndpoint,
        ...(logHeaderCount > 0 ? { headers: logHeaders } : {})
      })
    : undefined;

  if (logExporter && !logProcessorConfigured) {
    // sdk-logs >= 0.222: exporter is passed via a single options object.
    const logProcessor = new BatchLogRecordProcessor({
      exporter: logExporter,
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000,
      exportTimeoutMillis: 10000
    });

    if ('addLogRecordProcessor' in loggerProvider) {
      (
        loggerProvider as unknown as LoggerProviderWithProcessor
      ).addLogRecordProcessor(logProcessor);
    } else {
      // OTel SDK newer APIs configure processors via constructor.
      // Recreate provider so logs are always exported.
      loggerProvider = new LoggerProvider({
        resource,
        processors: [logProcessor]
      });
    }

    logProcessorConfigured = true;
  }

  sdk = new NodeSDK({
    resource,
    ...(traceExporter ? { traceExporter } : {}),
    ...(metricReader ? { metricReaders: [metricReader] } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false // Reduces noise
        }
      })
    ]
  });

  telemetryStartupSucceeded = false;
  telemetryStartupPromise = Promise.resolve(sdk.start())
    .then(() => {
      telemetryStartupSucceeded = true;
    })
    .catch((error) => {
      writeBootstrap('error', 'Telemetry SDK start failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

  telemetryBootstrapPromise = telemetryStartupPromise.then(async () => {
    if (
      !telemetryStartupSucceeded ||
      !logProcessorConfigured ||
      !logsEndpoint
    ) {
      return;
    }

    await loggerProvider.forceFlush().catch((err: unknown) => {
      writeBootstrap(
        'warn',
        'Bootstrap log forceFlush failed – logs may not export initially',
        {
          error: err instanceof Error ? err.message : String(err),
          logsEndpoint
        }
      );
    });
  });

  telemetryInitialized = true;
  telemetryShuttingDown = false;

  writeBootstrap('info', 'Telemetry initialized', {
    service: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
    version: env.OTEL_SERVICE_VERSION
  });

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
}

export async function waitForTelemetryStartup(): Promise<void> {
  await telemetryBootstrapPromise;
}

// ═══════════════════════════════════════════════════════════════════
// SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

export async function shutdownTelemetry() {
  if (!telemetryInitialized || !sdk) return;
  if (telemetryShuttingDown) return;

  telemetryShuttingDown = true;

  const activeSdk = sdk;

  try {
    await telemetryBootstrapPromise;

    // Reset LogTape before shutting down the OTel provider so any
    // in-flight log records are flushed through the OTel sink first.
    if (loggingConfigured) {
      try {
        const { reset } = await import('@logtape/logtape');
        await reset();
      } catch (error) {
        writeBootstrap('error', 'Failed to reset LogTape during shutdown', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        loggingConfigured = false;
      }
    }

    try {
      await loggerProvider.forceFlush();
    } catch (error) {
      writeBootstrap('error', 'Telemetry forceFlush failed during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await loggerProvider.shutdown();
    } catch (error) {
      writeBootstrap('error', 'Telemetry logger provider shutdown failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await activeSdk.shutdown();
    } catch (error) {
      writeBootstrap('error', 'Telemetry SDK shutdown failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Reset OTel globals so tests and other controlled re-init paths can
    // register fresh providers after shutdown.
    trace.disable();
    metrics.disable();
    propagation.disable();
    context.disable();

    sdk = null;
    telemetryInitialized = false;
    telemetryShuttingDown = false;
    logProcessorConfigured = false;
    telemetryStartupPromise = Promise.resolve();
    telemetryBootstrapPromise = Promise.resolve();
    telemetryStartupSucceeded = false;
    loggerProvider = createLoggerProvider();

    writeBootstrap('info', 'Telemetry shut down gracefully');
  } catch (error) {
    telemetryShuttingDown = false;
    writeBootstrap('error', 'Error shutting down telemetry', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// LOGTAPE LOGGING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Custom field patterns for PII redaction.
 * Replicates the original SENSITIVE_FIELDS set from the manual logger
 * plus coverage for common variations via regex.
 */
const URLFY_REDACT_FIELDS: (string | RegExp)[] = [
  /^pass(word|Hash|code|phrase)?$/i,
  /^(api)?(Key|Secret)(Hash)?$/i,
  /^(access|refresh)?[Tt]oken$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^email$/i,
  /^(ip|ipAddress)$/i,
  /^(creditCard|ssn)$/i
];

const URLFY_REDACT_PATTERNS: (string | RegExp)[] = [
  ...DEFAULT_REDACT_FIELDS,
  ...URLFY_REDACT_FIELDS
];

/**
 * Configure LogTape logging pipeline.
 *
 * MUST be called AFTER `initTelemetry()` to ensure the OTel SDK and
 * LoggerProvider are ready. Uses the same `loggerProvider` instance
 * already configured in this module — zero duplication of exporters.
 *
 * Sinks:
 * - otel: Sends logs via the existing OTel LoggerProvider to the OTLP collector
 * - console: Structured console output (dev only), wrapped with field redaction
 *
 * Categories:
 * - ["urlfy"]         — root category for all app logs
 * - ["urlfy", "http"] — Elysia request logging (via @logtape/elysia)
 * - ["urlfy", "db"]   — Drizzle ORM query logging (via @logtape/drizzle-orm)
 * - ["drizzle-orm"]   — default category used by @logtape/drizzle-orm
 * - ["logtape", "meta"] — LogTape internal diagnostics
 */
export async function configureLogging(): Promise<void> {
  if (loggingConfigured) return;

  await telemetryStartupPromise;

  const isDev = process.env.NODE_ENV === 'development';
  // Use the module-level logProcessorConfigured flag rather than re-reading env vars.
  // This accurately reflects whether the OTel log pipeline was set up in initTelemetry().
  const telemetryActive = logProcessorConfigured;

  // Build sinks
  const sinks: Record<string, Sink> = {};

  if (telemetryActive) {
    // Use existing loggerProvider — logs go through the same
    // BatchLogRecordProcessor → OTLPLogExporter pipeline already configured.
    // LogTape handles body/attributes natively (no JSON.stringify).
    sinks.otel = getOpenTelemetrySink({
      loggerProvider,
      exceptionAttributes: 'semconv'
    });
  }

  if (isDev) {
    // Console sink with field-based PII redaction for development output
    sinks.console = redactByField(getConsoleSink(), {
      fieldPatterns: URLFY_REDACT_PATTERNS,
      action: () => '[REDACTED]'
    });
  }

  // Determine available sink names
  const appSinks = Object.keys(sinks);

  if (appSinks.length === 0) {
    // Production without telemetry — no sinks, logging is effectively noop.
    loggingConfigured = true;
    writeBootstrap('warn', 'No logging sinks available', {
      telemetryActive,
      isDev
    });
    return;
  }

  try {
    await configure({
      sinks,
      loggers: [
        // Root app category — all urlfy logs
        {
          category: ['urlfy'],
          sinks: appSinks,
          lowestLevel: isDev ? 'debug' : 'info'
        },
        // Drizzle ORM query logging (uses its own default category)
        {
          category: ['drizzle-orm'],
          sinks: appSinks,
          lowestLevel: isDev ? 'debug' : 'warning'
        },
        // LogTape meta logger — for debugging LogTape itself
        {
          category: ['logtape', 'meta'],
          sinks: isDev ? ['console'] : [],
          lowestLevel: 'warning'
        }
      ],
      // Enable withContext() / withCategoryPrefix() for request correlation
      contextLocalStorage: new AsyncLocalStorage()
    });

    loggingConfigured = true;
    writeBootstrap('info', 'LogTape logging configured', {
      sinks: appSinks,
      telemetryActive,
      isDev
    });

    if (telemetryActive) {
      // Emit a single pipeline probe log through LogTape → OTel sink to confirm
      // the end-to-end path is wired. Distinguishes "pipeline initialized" from
      // "no log records were ever produced at runtime".
      const { getLogger: getLogTapeLogger } = await import('@logtape/logtape');
      getLogTapeLogger(['urlfy', 'telemetry']).info(
        'Telemetry logging pipeline active',
        { event: 'telemetry.logging.ready', sinks: appSinks }
      );
    }
  } catch (error) {
    writeBootstrap('error', 'Failed to configure LogTape', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw — logging failure should not crash the app
    loggingConfigured = true;
  }
}
