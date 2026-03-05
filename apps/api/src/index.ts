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

const PORT = Number(process.env.API_PORT) || 3001;

api.listen(PORT, () => {
  console.info(`[api] Elysia server listening on http://localhost:${PORT}`);
});

// Re-export App type for Eden Treaty type inference in apps/web
export type { App } from './server';
