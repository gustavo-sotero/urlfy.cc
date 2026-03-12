import { createLogger } from './logger';

const logger = createLogger('fire-and-forget');

/**
 * Execute a non-blocking side effect (analytics emit, metrics tracking, cache
 * invalidation, etc.) without blocking the caller. Failures are logged with
 * structured context instead of being silently swallowed.
 *
 * @param label  Short human-readable label for log attribution (e.g. 'analytics-emit', 'metrics-track')
 * @param fn     The async operation to execute
 * @param ctx    Optional structured context for the error log entry
 */
export function fireAndForget(
  label: string,
  fn: () => Promise<unknown>,
  ctx?: Record<string, unknown>
): void {
  fn().catch((err) => {
    logger.error(`[${label}] Non-blocking side effect failed`, {
      ...ctx,
      error: err instanceof Error ? err.message : String(err)
    });
  });
}
