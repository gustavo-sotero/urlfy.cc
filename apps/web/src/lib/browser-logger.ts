'use client';

import type { BrowserLogPayload } from './browser-log-contract';

/**
 * ═════════════════════════════════════════════════════════════════════
 * BROWSER LOGGER
 * ═════════════════════════════════════════════════════════════════════
 * Single browser-side error reporting helper.
 * - In development: logs to console only.
 * - In production: posts to /_monitor/log (fire-and-forget).
 * - Normalises unknown thrown values into a safe string.
 * - Strips query-string tokens and control characters from URLs.
 * - Never throws — error reporting must not break the UI.
 * ═════════════════════════════════════════════════════════════════════
 */

export type BrowserLogLevel = 'error' | 'warn';

/** Extracts a safe message string from any thrown value. */
export function normalizeError(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unknown error';
  }
}

/** Strips the query string from a URL to avoid token leakage in logs. */
function scrubUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    // Not a valid absolute URL — strip anything after '?'
    return url.split('?')[0] ?? url;
  }
}

/**
 * Report a browser-side error to the monitoring endpoint.
 *
 * @example
 * // In an error boundary:
 * reportBrowserError(error, { componentStack: info.componentStack });
 *
 * @example
 * // In an async handler:
 * reportBrowserError(caught, { requestId: apiResponse.requestId });
 */
export function reportBrowserError(
  value: unknown,
  extra: Omit<BrowserLogPayload, 'error'> = {}
): void {
  const message = normalizeError(value);
  const url = extra.url
    ? scrubUrl(extra.url)
    : typeof window !== 'undefined'
      ? scrubUrl(window.location.href)
      : undefined;

  const payload: BrowserLogPayload = {
    ...extra,
    error: message,
    url,
    timestamp: extra.timestamp ?? new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[browser-logger]', payload);
    return;
  }

  // Production: fire-and-forget POST to ingest route.
  // Errors from the log endpoint itself are swallowed intentionally.
  if (typeof window === 'undefined') return;

  fetch('/_monitor/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {
    // Intentionally silent — never throw from a logging helper.
  });
}

/**
 * Convenience wrapper for render boundary (React ErrorBoundary) callsites.
 */
export function reportRenderError(
  error: Error,
  componentStack: string | null | undefined,
  requestId?: string
): void {
  reportBrowserError(error, {
    componentStack: componentStack ?? undefined,
    requestId
  });
}

/**
 * Convenience wrapper for async action failures.
 */
export function reportActionError(
  value: unknown,
  context?: BrowserLogPayload['context'],
  requestId?: string
): void {
  reportBrowserError(value, { context, requestId });
}
