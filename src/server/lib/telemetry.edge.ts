// src/server/lib/telemetry.edge.ts
/**
 * Edge-compatible telemetry
 *
 * Next.js Edge Runtime doesn't support Node.js modules.
 * This is a lightweight implementation for middleware only.
 *
 * For full OpenTelemetry instrumentation, use telemetry.ts in API routes.
 */

export interface LogContext {
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface EdgeLogger {
  info: (message: string, ctx?: LogContext) => void;
  warn: (message: string, ctx?: LogContext) => void;
  error: (message: string, ctx?: LogContext) => void;
  debug: (message: string, ctx?: LogContext) => void;
}

/**
 * Creates a simple logger for Edge Runtime
 * Logs are sent to console in development and can be collected by external logging services
 */
export function createLogger(name: string): EdgeLogger {
  const log = (level: string, message: string, ctx?: LogContext) => {
    const logRecord = {
      level: level.toUpperCase(),
      message,
      timestamp: new Date().toISOString(),
      logger: name,
      ...ctx
    };

    // In production, these logs can be collected by services like Vercel Analytics,
    // Datadog, or other edge-compatible logging solutions
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logRecord, null, 2));
    } else {
      // Structured JSON for log aggregators
      console.log(JSON.stringify(logRecord));
    }
  };

  return {
    info: (message: string, ctx?: LogContext) => log('info', message, ctx),
    warn: (message: string, ctx?: LogContext) => log('warn', message, ctx),
    error: (message: string, ctx?: LogContext) => log('error', message, ctx),
    debug: (message: string, ctx?: LogContext) => {
      if (process.env.NODE_ENV === 'development') {
        log('debug', message, ctx);
      }
    }
  };
}

/**
 * Simple trace context for request correlation
 * Compatible with W3C Trace Context when external systems are available
 */
export function createTraceContext(requestId: string) {
  return {
    traceId: requestId,
    spanId: requestId.substring(0, 16)
  };
}

/**
 * Measure execution time
 */
export function measureTime() {
  const start = performance.now();

  return {
    end: () => performance.now() - start
  };
}
