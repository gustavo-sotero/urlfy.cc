/**
 * Shared classifier helpers for the security report.
 *
 * Kept separate from scripts/security-report.ts so tests can import the real
 * implementation without executing CLI argument parsing or report generation.
 */

export const UPSTREAM_UNAVAILABLE_CODES = new Set([
  'SERVICE_UNAVAILABLE',
  'DATABASE_UNAVAILABLE',
  'API_TIMEOUT',
  'API_UNAVAILABLE'
]);

/**
 * Determine if a non-expected response is due to upstream unavailability
 * rather than a real control failure.
 */
export async function isUpstreamUnavailable(
  res: Response
): Promise<boolean> {
  if (res.status !== 503 && res.status !== 502 && res.status !== 504) {
    return false;
  }

  try {
    const body = await res.clone().json();
    const errorCode = body?.error?.code;
    if (
      typeof errorCode === 'string' &&
      UPSTREAM_UNAVAILABLE_CODES.has(errorCode)
    ) {
      return true;
    }
  } catch {
    // Body is not JSON or unreadable — still treat 503 as upstream unavailable
    // since the gateway itself likely returned a generic error page.
  }

  return res.status === 502 || res.status === 503 || res.status === 504;
}