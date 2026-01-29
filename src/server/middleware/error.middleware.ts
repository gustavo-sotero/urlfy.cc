/**
 * Elysia Error Middleware
 * Global error handler for Elysia application
 * Catches and formats all errors into consistent API responses
 */

import { Elysia } from 'elysia';
import { ErrorCode, isAppError } from '../lib/error-handler';
import { createLogger } from '../lib/telemetry';

const logger = createLogger('error-middleware');

/**
 * Type guard to check if error has message property
 */
function hasMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard to check if error has stack property
 */
function hasStack(error: unknown): error is { stack: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'stack' in error &&
    typeof (error as { stack: unknown }).stack === 'string'
  );
}

/**
 * Error middleware plugin for Elysia
 * Handles AppError instances and unexpected errors
 *
 * @example
 * const app = new Elysia()
 *   .use(errorMiddleware)
 *   .get('/', () => {
 *     throw new AppError(ErrorCode.LINK_NOT_FOUND, 'Link not found');
 *   });
 */
export const errorMiddleware = new Elysia({ name: 'error-handler' }).onError(
  ({ error, set, request }) => {
    // Generate request ID for tracing (if not already present)
    const requestId =
      request.headers.get('x-request-id') || crypto.randomUUID();

    // Handle AppError instances
    if (isAppError(error)) {
      set.status = error.status;

      logger.warn('Application error', {
        requestId,
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
        path: new URL(request.url).pathname
      });

      return {
        success: false as const,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details })
        },
        requestId
      };
    }

    // Extract error message safely
    const errorMessage = hasMessage(error)
      ? error.message
      : 'An unexpected error occurred';

    // Handle Elysia validation errors (from TypeBox)
    if (errorMessage.includes('Validation')) {
      set.status = 400;

      logger.warn('Validation error', {
        requestId,
        message: errorMessage,
        path: new URL(request.url).pathname
      });

      return {
        success: false as const,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          details: {
            validationError: errorMessage
          }
        },
        requestId
      };
    }

    // Handle unexpected errors (500)
    set.status = 500;

    const errorStack = hasStack(error) ? error.stack : undefined;

    logger.error('Unexpected error', {
      requestId,
      message: errorMessage,
      stack: errorStack,
      path: new URL(request.url).pathname
    });

    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      success: false as const,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: isProduction ? 'An unexpected error occurred' : errorMessage,
        ...(!isProduction &&
          errorStack && {
            details: { stack: errorStack }
          })
      },
      requestId
    };
  }
);
