/**
 * Telemetry re-export for apps/api
 *
 * All telemetry (SDK lifecycle, structured logger, metrics) is provided by the
 * canonical @urlfy/telemetry package. This file exists solely to preserve the
 * `@/server/lib/telemetry` import alias used throughout the API codebase.
 *
 * The local apps/api/src/server/lib/telemetry/ directory (init.ts, logger.ts,
 * metrics.ts) is now dead code after this consolidation — see Wave 4C.
 */
export * from '@urlfy/telemetry';
