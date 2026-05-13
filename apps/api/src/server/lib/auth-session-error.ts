const AUTH_SESSION_MISS_STATUS_CODES = new Set([401, 404]);
const AUTH_SESSION_MISS_ERROR_CODES = new Set(['NOT_FOUND', 'UNAUTHORIZED']);

export function isMissingAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = Reflect.get(error, 'status');
  if (
    typeof status === 'number' &&
    AUTH_SESSION_MISS_STATUS_CODES.has(status)
  ) {
    return true;
  }

  const statusCode = Reflect.get(error, 'statusCode');
  if (
    typeof statusCode === 'number' &&
    AUTH_SESSION_MISS_STATUS_CODES.has(statusCode)
  ) {
    return true;
  }

  const code = Reflect.get(error, 'code');
  return typeof code === 'string' && AUTH_SESSION_MISS_ERROR_CODES.has(code);
}
