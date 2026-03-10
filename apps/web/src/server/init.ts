/**
 * ═════════════════════════════════════════════════════════════════════
 * apps/web - Server Init (Minimal)
 * ═════════════════════════════════════════════════════════════════════
 * Initializes only what apps/web needs at server startup:
 *   - Telemetry (logging + tracing)
 *   - Redis connection for redirect hot path
 *
 * NOTE: Database and full API server init happens in apps/api.
 * ═════════════════════════════════════════════════════════════════════
 */

import { configureLogging, initTelemetry } from '@urlfy/telemetry';
import { validateEnv } from '@/lib/env';

// Only initialize in server environment, skip during build phase
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  validateEnv();
  initTelemetry();
  await configureLogging();
}
