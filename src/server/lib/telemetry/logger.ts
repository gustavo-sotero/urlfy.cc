// src/server/lib/telemetry/logger.ts
/**
 * Structured logger built on top of OpenTelemetry LoggerProvider.
 *
 * Usage:
 *   const logger = createLogger('my-module');
 *   logger.info('Something happened', { userId: '123' });
 */

import { type Attributes, trace } from '@opentelemetry/api';
import { loggerProvider } from './init';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

export type Logger = ReturnType<typeof createLogger>;

function writeLine(stream: 'stdout' | 'stderr', payload: unknown) {
  const line = `${JSON.stringify(payload)}\n`;
  if (stream === 'stderr') {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

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

/**
 * Sensitive field names that should be redacted from log context.
 * Values are replaced with '[REDACTED]' to prevent PII/secrets leaking
 * into the observability pipeline.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'secret',
  'token',
  'authorization',
  'cookie',
  'email',
  'ip',
  'ipAddress',
  'creditCard',
  'ssn',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'keyHash'
]);

/**
 * Redact sensitive fields from log context to prevent PII leakage.
 * Only redacts top-level keys to avoid performance overhead of deep traversal.
 */
export function redactLogContext(ctx: LogContext): LogContext {
  const redacted: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (SENSITIVE_FIELDS.has(key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function createLogger(name: string) {
  const logger = loggerProvider.getLogger(name);

  const log = (level: string, message: string, ctx?: LogContext) => {
    // Redact sensitive fields before any logging/emission
    const safeCtx = ctx ? redactLogContext(ctx) : ctx;

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
      ...safeCtx
    };

    if (spanContext) {
      logRecord.traceId = spanContext.traceId;
      logRecord.spanId = spanContext.spanId;
    }

    // Emit structured log record
    const attributes = toOtelAttributes(logRecord) as unknown as Attributes;

    try {
      logger.emit({
        severityText: level.toUpperCase(),
        body: JSON.stringify(logRecord),
        attributes
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        writeLine('stderr', {
          event: 'failed-to-emit-log-record',
          error: error instanceof Error ? error.message : String(error),
          logger: name,
          level,
          message
        });
      }
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      writeLine('stdout', logRecord);
    }
  };

  return {
    debug: (message: string, ctx?: LogContext) => log('debug', message, ctx),
    info: (message: string, ctx?: LogContext) => log('info', message, ctx),
    warn: (message: string, ctx?: LogContext) => log('warn', message, ctx),
    error: (message: string, ctx?: LogContext) => log('error', message, ctx)
  };
}
