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
// RESOURCE (Service Identification)
// ═══════════════════════════════════════════════════════════════════

const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

// ═══════════════════════════════════════════════════════════════════
// LOGGER PROVIDER
// ═══════════════════════════════════════════════════════════════════

export const loggerProvider = new LoggerProvider({ resource });

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

  const env = getEnv();

  if (!env.TELEMETRY_ENABLED) {
    writeBootstrap('info', 'Telemetry disabled', {
      reason: 'TELEMETRY_ENABLED=false'
    });
    telemetryInitialized = true;
    return;
  }

  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    writeBootstrap('warn', 'Telemetry enabled but endpoint is missing', {
      reason: 'OTEL_EXPORTER_OTLP_ENDPOINT not set'
    });
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
        exportIntervalMillis: 60000 // 1 minute
      })
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false // Reduces noise
        }
      })
    ]
  });

  sdk.start();
  telemetryInitialized = true;
  telemetryShuttingDown = false;

  writeBootstrap('info', 'Telemetry initialized', {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    service: process.env.OTEL_SERVICE_NAME || 'urlfy-api'
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

  void loggerProvider.forceFlush().catch(() => {
    // Best effort: telemetry should never crash app startup
  });
}

// ═══════════════════════════════════════════════════════════════════
// SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

export async function shutdownTelemetry() {
  try {
    if (!telemetryInitialized || !sdk) return;
    if (telemetryShuttingDown) return;

    telemetryShuttingDown = true;

    // Reset LogTape before shutting down the OTel provider so any
    // in-flight log records are flushed through the OTel sink first.
    if (loggingConfigured) {
      const { reset } = await import('@logtape/logtape');
      await reset();
      loggingConfigured = false;
    }

    await loggerProvider.forceFlush();
    await loggerProvider.shutdown();
    await sdk.shutdown();

    sdk = null;
    telemetryInitialized = false;
    telemetryShuttingDown = false;

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
 * - otel: Sends logs via the existing OTel LoggerProvider to SigNoz
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

  const env = getEnv();
  const isDev = process.env.NODE_ENV === 'development';
  const telemetryActive =
    env.TELEMETRY_ENABLED && !!env.OTEL_EXPORTER_OTLP_ENDPOINT;

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
  } catch (error) {
    writeBootstrap('error', 'Failed to configure LogTape', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw — logging failure should not crash the app
    loggingConfigured = true;
  }
}
