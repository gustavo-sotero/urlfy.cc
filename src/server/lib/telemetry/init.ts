// src/server/lib/telemetry/init.ts
/**
 * OpenTelemetry SDK initialization for Node.js runtime.
 *
 * WARNING: DO NOT import this file in proxy.ts or Middleware code!
 * This module uses Node.js-specific APIs not available in Edge/Middleware.
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
