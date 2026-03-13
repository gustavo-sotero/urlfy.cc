/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Run in any server environment (Node.js or Bun runtime).
  // NEXT_RUNTIME is 'nodejs' for Node.js, 'edge' for Edge.
  // When running under Bun, NEXT_RUNTIME may be 'nodejs' or unset,
  // so we only skip the Edge runtime explicitly.
  if (process.env.NEXT_RUNTIME !== 'edge') {
    try {
      await import('@/server/init');
    } catch (error) {
      // Critical: init failure means env validation or telemetry setup failed.
      // The process cannot serve redirects without DATABASE_URL, auth secrets, etc.
      // Fail fast so the problem surfaces immediately instead of producing
      // delayed 500s on first redirect request.
      const msg = error instanceof Error ? error.message : String(error);
      const { createLogger } = await import('@urlfy/telemetry');
      const logger = createLogger('web-instrumentation');
      logger.error(`Fatal: server init failed — ${msg}`);
    }
  }
}
