/**
 * Error message sanitization utility
 * Prevents leaking internal server details (SQL, stack traces, file paths)
 * to end users while preserving intentional validation error messages.
 */

/** Patterns that indicate server-internal error messages */
const INTERNAL_PATTERNS = [
  /ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND/i,
  /at\s+[\w$.]+\s*\(/, // stack trace lines: "at Module._compile ("
  /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.*\b(FROM|WHERE|SET|INTO)\b/i, // SQL fragments
  /\/src\/|\/node_modules\/|\.ts:|\.js:/, // file paths
  /\bINTERNAL\b/i,
  /\b50[0-3]\b/, // 500-503 status codes
  /connection\s+(refused|reset|closed)/i,
  /drizzle|prisma|postgres|redis/i // ORM/DB names
];

const MAX_SAFE_LENGTH = 200;

/**
 * Sanitize an error message for display to users.
 * Returns the original message if it looks like a user-facing validation error,
 * otherwise returns the fallback message.
 */
export function sanitizeErrorMessage(
  message: string | undefined,
  fallback: string
): string {
  if (!message) return fallback;

  // Long messages are likely stack traces or debug dumps
  if (message.length > MAX_SAFE_LENGTH) return fallback;

  // Check for internal error patterns
  for (const pattern of INTERNAL_PATTERNS) {
    if (pattern.test(message)) return fallback;
  }

  return message;
}
