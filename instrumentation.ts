/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (only in Node.js, not Edge Runtime)
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Suppress BullMQ eviction policy warning BEFORE any imports
// This warning appears because managed Redis (like Redis Cloud) uses volatile-lru
// but we can't change the server configuration.
if (typeof console !== 'undefined') {
  const originalLog = console.log;
  const originalWarn = console.warn;

  const suppressEvictionWarning = (originalFn: typeof console.log) => {
    return (...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === 'string' &&
        message.includes('Eviction policy is volatile-lru')
      ) {
        return; // Suppress this warning
      }
      originalFn.apply(console, args);
    };
  };

  console.log = suppressEvictionWarning(originalLog);
  console.warn = suppressEvictionWarning(originalWarn);
}

export async function register() {
  // Only run in Node.js server environment
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/server/init');
  }
}
