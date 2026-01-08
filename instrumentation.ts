/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (only in Node.js, not Edge Runtime)
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js server environment
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/server/init');
  }
}
