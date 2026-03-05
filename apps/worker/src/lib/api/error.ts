// src/lib/api/error.ts
/**
 * API Error Handling Utilities
 * Provides consistent error handling for Eden Treaty responses
 */

// ═══════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Eden Treaty response structure from @elysiajs/eden
 */
export interface TreatyResponse<T = unknown> {
  data: T;
  error: null | {
    status: number;
    value: unknown;
  };
  response: Response;
  status: number;
  headers?: HeadersInit;
}

/**
 * Backend API error structure
 */
export interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Backend API success response structure
 */
export interface BackendSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: BackendErrorResponse;
  requestId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isBackendSuccessResponse(
  value: unknown
): value is BackendSuccessResponse<unknown> {
  return isRecord(value) && typeof value.success === 'boolean';
}

// ═══════════════════════════════════════════════════════════════════
// ERROR EXTRACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracts error information from Eden Treaty error response
 */
export function extractErrorInfo(errorValue: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
} {
  const fallback = {
    code: 'UNKNOWN_ERROR',
    message: 'Request failed'
  };

  if (!errorValue || typeof errorValue !== 'object') {
    if (typeof errorValue === 'string') {
      return { ...fallback, message: errorValue };
    }
    if (errorValue instanceof Error) {
      return {
        code: 'NETWORK_ERROR',
        message: errorValue.message
      };
    }
    return fallback;
  }

  const errorObj = errorValue as Record<string, unknown>;

  // Handle structured error responses from backend
  if (errorObj.error && typeof errorObj.error === 'object') {
    const backendError = errorObj.error as Record<string, unknown>;
    return {
      code: (backendError.code as string) || fallback.code,
      message: (backendError.message as string) || fallback.message,
      details: backendError.details as Record<string, unknown> | undefined,
      requestId: errorObj.requestId as string | undefined
    };
  }

  // Handle Error objects from network failures
  if (errorObj.message && typeof errorObj.message === 'string') {
    return {
      code: 'NETWORK_ERROR',
      message: errorObj.message,
      requestId: errorObj.requestId as string | undefined
    };
  }

  return {
    ...fallback,
    requestId: errorObj.requestId as string | undefined
  };
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Adapter to maintain backward compatibility with existing error handling
 * Converts Eden Treaty error responses to ApiClientError
 *
 * This function is intentionally permissive with input types since Eden Treaty
 * returns union types based on HTTP status codes.
 *
 * Overload for void operations (DELETE, etc.) — callers should use handleEdenVoid.
 */
export function handleEdenVoid(response: TreatyResponse<unknown>): void {
  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);
    const requestId =
      errorInfo.requestId ||
      response.response?.headers.get('x-request-id') ||
      undefined;
    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message,
      errorInfo.details,
      requestId
    );
  }
  // Void — nothing to return
}

/**
 * Type-safe Eden Treaty response handler.
 *
 * Overloads:
 *   - handleEden<void>(response) → void (for 204/no-content)
 *   - handleEden<T>(response) → T    (for data responses)
 *
 * Runtime checks ensure the response has the expected structure before
 * returning, throwing ApiClientError on unexpected shapes. The remaining
 * `as T` casts are intentional — they sit at the untyped Eden ↔ typed
 * caller boundary after all runtime guards have passed.
 */
export function handleEden<T>(response: TreatyResponse<unknown>): T;
export function handleEden(response: TreatyResponse<unknown>): unknown {
  if (response.error) {
    const errorInfo = extractErrorInfo(response.error.value);

    // Extract request ID from response headers if not in error value
    const requestId =
      errorInfo.requestId ||
      response.response?.headers.get('x-request-id') ||
      undefined;

    throw new ApiClientError(
      errorInfo.code,
      errorInfo.message,
      errorInfo.details,
      requestId
    );
  }

  // Data handlers should not be used for 204 No Content responses.
  // Use handleEdenVoid for endpoints that intentionally return no payload.
  if (response.status === 204 || response.response?.status === 204) {
    throw new ApiClientError(
      'NO_CONTENT',
      'No content response for data handler. Use handleEdenVoid for void endpoints.'
    );
  }

  // Eden Treaty returns { data: T } where T is the backend response
  // Backend returns { success: boolean, data: actualData, meta?: ... }
  const apiResponse = response.data;

  // Handle empty responses gracefully (may occur with some endpoints)
  if (!apiResponse) {
    throw new ApiClientError('NO_DATA', 'No data received from server');
  }

  if (!isBackendSuccessResponse(apiResponse)) {
    throw new ApiClientError(
      'INVALID_RESPONSE',
      'Invalid API response structure'
    );
  }

  // Check for error in response data
  if (!apiResponse.success && apiResponse.error) {
    throw new ApiClientError(
      apiResponse.error.code,
      apiResponse.error.message,
      apiResponse.error.details,
      apiResponse.requestId
    );
  }

  // For paginated responses, return both data and meta
  if (apiResponse.meta && apiResponse.data !== undefined) {
    return { data: apiResponse.data, meta: apiResponse.meta };
  }

  // Return unwrapped data — verified non-null
  if (apiResponse.data !== undefined) {
    return apiResponse.data;
  }

  throw new ApiClientError(
    'NO_DATA',
    'Response succeeded but did not include a data payload'
  );
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracts array data from API response, handling both direct arrays and paginated responses
 * This utility reduces code duplication in analytics endpoints
 */
function hasArrayData(value: unknown): value is { data: unknown[] } {
  return isRecord(value) && Array.isArray(value.data);
}

export function extractArrayData<T>(result: unknown): T[];
export function extractArrayData(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (hasArrayData(result)) {
    return result.data;
  }

  return [];
}

/**
 * Converts typed query parameters to string format for API requests
 * Handles numbers, booleans, arrays, and undefined values
 */
export function toQueryParams(
  query: Record<string, string | number | boolean | string[] | undefined | null>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else {
      result[key] = String(value);
    }
  }
  return result;
}
