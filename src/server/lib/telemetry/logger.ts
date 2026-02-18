// src/server/lib/telemetry/logger.ts
/**
 * Structured logger adapter over LogTape.
 *
 * Maintains backward compatibility with the existing createLogger API:
 *   const logger = createLogger('my-module');
 *   logger.info('Something happened', { userId: '123' });
 *
 * Internally uses LogTape's getLogger(['urlfy', name]) to leverage
 * the LogTape pipeline (OTel sink, redaction, categories).
 * The logging pipeline is configured in configureLogging() (init.ts).
 */

import { getLogger as getLogTapeLogger } from '@logtape/logtape';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

export type Logger = ReturnType<typeof createLogger>;

/**
 * @deprecated Redaction is now handled at the sink level by @logtape/redaction.
 * Kept for backward compatibility with existing tests that import this function.
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
 * @deprecated Redaction is now handled at the sink level by @logtape/redaction
 * via redactByField() in configureLogging(). Kept for backward compatibility
 * with tests that import this function directly.
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

/**
 * Create a structured logger for a given module name.
 *
 * Category: ["urlfy", name] — inherits sinks configured for ["urlfy"].
 * Redaction: Handled at the sink level (not per-call).
 * OTel correlation: The @logtape/otel sink automatically picks up
 *   the active trace/span context — no manual injection needed.
 */
export function createLogger(name: string) {
  const logger = getLogTapeLogger(['urlfy', name]);

  const log = (
    level: 'debug' | 'info' | 'warning' | 'error',
    message: string,
    ctx?: LogContext
  ) => {
    if (ctx) {
      logger[level](message, ctx);
    } else {
      logger[level](message);
    }
  };

  return {
    debug: (message: string, ctx?: LogContext) => log('debug', message, ctx),
    info: (message: string, ctx?: LogContext) => log('info', message, ctx),
    // LogTape uses 'warning' internally; map 'warn' for backward compat
    warn: (message: string, ctx?: LogContext) => log('warning', message, ctx),
    error: (message: string, ctx?: LogContext) => log('error', message, ctx)
  };
}
