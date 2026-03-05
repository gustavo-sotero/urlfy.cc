type ErrorDetails = Record<string, unknown> | undefined;

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
    retryAfter?: number;
  };
  requestId: string;
}

export function getOrCreateRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ||
    `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export function buildErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: ErrorDetails,
  retryAfter?: number
): ErrorEnvelope {
  const normalizedDetails =
    typeof retryAfter === 'number'
      ? {
          ...(details ?? {}),
          retryAfter
        }
      : details;

  return {
    success: false,
    error: {
      code,
      message,
      ...(normalizedDetails && { details: normalizedDetails }),
      ...(typeof retryAfter === 'number' && { retryAfter })
    },
    requestId
  };
}

export function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  options?: {
    details?: ErrorDetails;
    retryAfter?: number;
    headers?: Record<string, string>;
  }
): Response {
  const envelope = buildErrorEnvelope(
    code,
    message,
    requestId,
    options?.details,
    options?.retryAfter
  );

  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      ...(options?.headers ?? {})
    }
  });
}
