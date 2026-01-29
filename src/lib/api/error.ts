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
 * returns union types based on HTTP status codes. The return type T is trusted
 * based on the caller's expectation.
 */
export function handleEden<T>(response: TreatyResponse<unknown>): T {
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

  // Handle 204 No Content responses (e.g., DELETE operations)
  if (response.status === 204 || response.response?.status === 204) {
    return undefined as T;
  }

  // Eden Treaty returns { data: T } where T is the backend response
  // Backend returns { success: boolean, data: actualData, meta?: ... }
  const apiResponse = response.data as BackendSuccessResponse | null;

  // Handle empty responses gracefully (may occur with some endpoints)
  if (!apiResponse) {
    // For void operations, return undefined
    if (response.status >= 200 && response.status < 300) {
      return undefined as T;
    }
    throw new ApiClientError('NO_DATA', 'No data received from server');
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
    return { data: apiResponse.data, meta: apiResponse.meta } as T;
  }

  // Return unwrapped data
  if (apiResponse.data !== undefined) {
    return apiResponse.data as T;
  }

  // For responses with no data field (like void/delete)
  return apiResponse as T;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracts array data from API response, handling both direct arrays and paginated responses
 * This utility reduces code duplication in analytics endpoints
 */
export function extractArrayData<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result && typeof result === 'object' && 'data' in result) {
    const dataValue = (result as { data: unknown }).data;
    if (Array.isArray(dataValue)) {
      return dataValue as T[];
    }
  }

  // Log unexpected structure for debugging
  console.error(
    '[API Client] Expected array or paginated response, got:',
    typeof result
  );
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
