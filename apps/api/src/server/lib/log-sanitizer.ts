/**
 * Log Sanitization Utilities
 * Prevents sensitive data from leaking into logs
 */

/**
 * Sensitive headers that should never be logged in full
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-api-secret',
  'x-auth-token',
  'x-session-token'
] as const;

/**
 * Mask a sensitive value, showing only the last few characters
 * @param value - The value to mask
 * @param visibleChars - Number of trailing characters to show (default: 4)
 * @returns Masked string like "*****a1b2"
 */
export function maskValue(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) {
    return '[REDACTED]';
  }

  const visible = value.slice(-visibleChars);
  const maskedLength = Math.min(value.length - visibleChars, 10);
  return '*'.repeat(maskedLength) + visible;
}

/**
 * Sanitize request headers for safe logging
 * @param headers - Request headers
 * @returns Sanitized headers object safe for logging
 */
export function sanitizeHeaders(
  headers: Headers | Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  // Convert Headers to plain object if needed
  const headerEntries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of headerEntries) {
    if (!value) continue;

    const lowerKey = key.toLowerCase();

    // Check if header is sensitive
    if (SENSITIVE_HEADERS.some((sensitive) => lowerKey.includes(sensitive))) {
      // Special handling for different header types
      if (lowerKey === 'authorization') {
        // Bearer token: show last 4 chars
        if (value.startsWith('Bearer ')) {
          const token = value.slice(7);
          sanitized[key] = `Bearer ${maskValue(token)}`;
        } else {
          sanitized[key] = '[PRESENT]';
        }
      } else if (lowerKey === 'cookie') {
        // Count cookies but don't show values
        const cookieCount = value.split(';').length;
        sanitized[key] = `[${cookieCount} cookie(s)]`;
      } else if (lowerKey === 'x-api-key') {
        // Show prefix for API keys
        sanitized[key] = maskValue(value, 6);
      } else {
        // Generic masking
        sanitized[key] = '[PRESENT]';
      }
    } else {
      // Non-sensitive headers: log as-is
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize an IP address for logging (partial masking)
 * @param ip - IP address (v4 or v6)
 * @returns Partially masked IP
 */
export function sanitizeIP(ip: string): string {
  // IPv4: mask last octet (e.g., "192.168.1.xxx")
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }

  // IPv6: mask last 4 groups
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(':')}:xxxx:xxxx:xxxx:xxxx`;
    }
  }

  return '[IP]';
}
