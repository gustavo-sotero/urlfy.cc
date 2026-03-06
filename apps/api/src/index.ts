/**
 * ═════════════════════════════════════════════════════════════════════
 * apps/api - Standalone Elysia HTTP Server Entry Point
 * ═════════════════════════════════════════════════════════════════════
 * Initializes telemetry/DB, then starts the Elysia server on API_PORT.
 * This process is separate from the Next.js web app.
 * ═════════════════════════════════════════════════════════════════════
 */

// Side-effect: validates env, initialises telemetry, DB, CORS and graceful shutdown
import './server/init';
import { api } from './server';
import { createLogger } from './server/lib/telemetry';

const PORT = Number(process.env.API_PORT) || 3001;
const logger = createLogger('api');

api.listen(PORT, () => {
  logger.info('[api] Elysia server listening', { port: PORT });
});

// Re-export App type for external tooling and tests.
// apps/web should prefer shared contracts from @urlfy/contracts.
export type { App } from './server';
