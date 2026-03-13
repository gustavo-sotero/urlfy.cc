/**
 * ═════════════════════════════════════════════════════════════════════
 * apps/web - Server Init
 * ═════════════════════════════════════════════════════════════════════
 * Initializes what apps/web needs at server startup:
 *   - Environment validation (DATABASE_URL, auth secrets, etc.)
 *   - Telemetry (logging + tracing)
 *
 * NOTE: The redirect hot path resolves links locally via
 * @urlfy/redirect-domain, which falls back to PostgreSQL on cache
 * miss. Therefore apps/web requires DATABASE_URL at runtime — not
 * only apps/api. A non-fatal DB probe runs here to surface config
 * issues at startup instead of on first redirect request.
 * ═════════════════════════════════════════════════════════════════════
 */

import { checkDatabaseHealth } from '@urlfy/data';
import {
  configureLogging,
  createLogger,
  initTelemetry
} from '@urlfy/telemetry';
import { validateEnv } from '@/lib/env';

// Only initialize in server environment, skip during build phase
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  validateEnv();
  initTelemetry();
  await configureLogging();

  // Non-fatal DB probe — surface misconfiguration early.
  // Redirect will still work on cache hits even if DB is temporarily unreachable.
  const logger = createLogger('web-init');
  checkDatabaseHealth()
    .then((result) => {
      if (result.status === 'ok') {
        logger.info(`Database probe OK (${result.latencyMs}ms)`);
      } else {
        logger.error(`Database probe failed: ${result.error}`);
      }
    })
    .catch((err: unknown) => {
      logger.error(
        `Database probe exception: ${err instanceof Error ? err.message : String(err)}`
      );
    });
}
