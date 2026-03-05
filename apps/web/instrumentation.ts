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
      console.error(
        '❌ Failed to load server init module:',
        error instanceof Error ? error.message : error
      );
    }
  }
}
