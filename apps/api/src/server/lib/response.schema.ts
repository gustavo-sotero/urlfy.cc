/**
 * ═════════════════════════════════════════════════════════════════════
 * RESPONSE SCHEMA LIBRARY - Standardized API response schemas
 * ═════════════════════════════════════════════════════════════════════
 * Module: Core Library
 * Pattern: TypeBox schemas for OpenAPI response documentation
 * Spec: README.md#api-response-format
 *
 * This module provides:
 * - SuccessResponse<T>: Wrapper for successful API responses
 * - PaginatedResponse<T>: Wrapper for paginated list responses
 * - ErrorResponse: Standard error envelope
 * - CommonErrors: Pre-defined error schemas by HTTP status code
 * - ResponseModels: Elysia plugin registering all response models
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type TSchema, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// ERROR CODES ENUM (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════

/**
 * All possible error codes used in the API.
 */
export const ErrorCodes = t.Union(
  [
    t.Literal('VALIDATION_ERROR'),
    t.Literal('UNAUTHORIZED'),
    t.Literal('PASSWORD_REQUIRED'),
    t.Literal('INVALID_PASSWORD'),
    t.Literal('FORBIDDEN'),
    t.Literal('NOT_FOUND'),
    t.Literal('LINK_NOT_FOUND'),
    t.Literal('USER_NOT_FOUND'),
    t.Literal('SESSION_NOT_FOUND'),
    t.Literal('LINK_EXPIRED'),
    t.Literal('REDIRECT_LOOP'),
    t.Literal('URL_MALICIOUS'),
    t.Literal('INVALID_URL'),
    t.Literal('SHORTENER_BLOCKED'),
    t.Literal('URL_INTERNAL_BLOCKED'),
    t.Literal('URL_RESOLUTION_FAILED'),
    t.Literal('RATE_LIMITED'),
    t.Literal('LINK_BANNED'),
    t.Literal('QUOTA_EXCEEDED'),
    t.Literal('INTERNAL_ERROR'),
    t.Literal('REQUEST_ALREADY_EXISTS'),
    t.Literal('CONFLICT'),
    t.Literal('EMAIL_VERIFICATION_REQUIRED'),
    t.Literal('INVALID_IDEMPOTENCY_KEY'),
    t.Literal('EXPORT_FAILED'),
    t.Literal('DELETION_FAILED'),
    t.Literal('NO_DATA'),
    t.Literal('INVALID_DAYS_RANGE'),
    t.Literal('2FA_REQUIRED')
  ],
  { description: 'Standard API error codes' }
);

// ═══════════════════════════════════════════════════════════════════
// RESPONSE WRAPPER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for success response wrapper
 */
interface SuccessResponseOptions {
  /** Optional description for OpenAPI docs */
  description?: string;
  /** Optional example data to display in OpenAPI docs */
  example?: unknown;
}

/**
 * Error examples by status code for OpenAPI documentation
 */
export const ERROR_EXAMPLES = {
  400: {
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'URL is required' },
    requestId: 'req_abc123xyz'
  },
  401: {
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
  },
  403: {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource'
    }
  },
  404: {
    success: false,
    error: { code: 'LINK_NOT_FOUND', message: 'Link not found' }
  },
  409: {
    success: false,
    error: { code: 'CONFLICT', message: 'Custom alias already in use' }
  },
  410: {
    success: false,
    error: {
      code: 'LINK_EXPIRED',
      message: 'This link expired on 2026-01-01T00:00:00Z'
    }
  },
  422: {
    success: false,
    error: {
      code: 'URL_MALICIOUS',
      message: 'URL detected as potentially malicious'
    }
  },
  429: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      retryAfter: 60
    }
  },
  451: {
    success: false,
    error: {
      code: 'LINK_BANNED',
      message: 'This link has been banned for violating terms of service'
    }
  },
  500: {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    requestId: 'req_abc123xyz'
  }
} as const;

/**
 * Creates an error response reference with inline example for proper Swagger UI display.
 * Use this instead of t.Ref('response.error.XXX') for better documentation.
 *
 * @param statusCode - HTTP status code
 * @returns Schema with reference and example
 */
export function ErrorRef(statusCode: keyof typeof ERROR_EXAMPLES) {
  const example = ERROR_EXAMPLES[statusCode];

  // Return a reference to the registered model
  return t.Ref(`response.error.${statusCode}`, {
    examples: [example]
  });
}

/**
 * Creates a success response schema wrapper
 * @param dataSchema - The schema for the `data` field
 * @param descriptionOrOptions - Description string or options object
 *
 * Note: When using t.Ref(), pass an example to ensure proper documentation.
 * Example: SuccessResponse(t.Ref('links.response'), { description: '...', example: { id: '...', ... } })
 */
export const SuccessResponse = <T extends TSchema>(
  dataSchema: T,
  descriptionOrOptions?: string | SuccessResponseOptions
) => {
  const options: SuccessResponseOptions =
    typeof descriptionOrOptions === 'string'
      ? { description: descriptionOrOptions }
      : (descriptionOrOptions ?? {});

  return t.Object(
    {
      success: t.Literal(true, { default: true }),
      data: dataSchema
    },
    {
      description: options.description ?? 'Successful response',
      ...(options.example
        ? { examples: [{ success: true, data: options.example }] }
        : {})
    }
  );
};

/**
 * Options for paginated response wrapper
 */
interface PaginatedResponseOptions {
  /** Optional description for OpenAPI docs */
  description?: string;
  /** Optional example item to display in OpenAPI docs */
  exampleItem?: unknown;
}

/**
 * Creates a paginated success response schema wrapper
 * @param itemSchema - The schema for each item in the `data` array
 * @param descriptionOrOptions - Description string or options object
 *
 * Note: When using t.Ref(), pass an exampleItem to ensure proper documentation.
 */
export const PaginatedResponse = <T extends TSchema>(
  itemSchema: T,
  descriptionOrOptions?: string | PaginatedResponseOptions
) => {
  const options: PaginatedResponseOptions =
    typeof descriptionOrOptions === 'string'
      ? { description: descriptionOrOptions }
      : (descriptionOrOptions ?? {});

  return t.Object(
    {
      success: t.Literal(true, { default: true }),
      data: t.Array(itemSchema),
      meta: t.Object(
        {
          total: t.Number({
            description: 'Total number of items',
            examples: [100]
          }),
          page: t.Number({ description: 'Current page number', examples: [1] }),
          perPage: t.Number({ description: 'Items per page', examples: [20] }),
          lastPage: t.Number({
            description: 'Last page number',
            examples: [5]
          }),
          hasMore: t.Boolean({
            description: 'Whether there are more pages',
            examples: [true]
          })
        },
        { description: 'Pagination metadata' }
      )
    },
    {
      description: options.description ?? 'Paginated response',
      ...(options.exampleItem
        ? {
            examples: [
              {
                success: true,
                data: [options.exampleItem],
                meta: {
                  total: 100,
                  page: 1,
                  perPage: 20,
                  lastPage: 5,
                  hasMore: true
                }
              }
            ]
          }
        : {})
    }
  );
};

/**
 * Standard error response schema with examples
 */
export const ErrorResponse = t.Object(
  {
    success: t.Literal(false, { default: false }),
    error: t.Object(
      {
        code: t.String({
          description: 'Error code for programmatic handling',
          examples: ['VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED']
        }),
        message: t.String({
          description: 'Human-readable error message',
          examples: ['Validation failed', 'Resource not found']
        }),
        details: t.Optional(
          t.Unknown({
            description: 'Additional error context (validation errors, etc.)'
          })
        )
      },
      { description: 'Error details' }
    ),
    requestId: t.Optional(
      t.String({
        description: 'Request correlation ID for debugging',
        examples: ['req_abc123xyz']
      })
    )
  },
  {
    description: 'Standard error response envelope',
    examples: [
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data'
        },
        requestId: 'req_abc123xyz'
      }
    ]
  }
);

// ═══════════════════════════════════════════════════════════════════
// COMMON ERROR RESPONSES BY STATUS CODE (with examples)
// ═══════════════════════════════════════════════════════════════════

export const CommonErrors = {
  400: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.String({
          examples: ['VALIDATION_ERROR', 'INVALID_IDEMPOTENCY_KEY']
        }),
        message: t.String({
          examples: ['Invalid input data', 'Idempotency key is invalid']
        }),
        details: t.Optional(t.Unknown())
      }),
      requestId: t.Optional(t.String({ examples: ['req_abc123xyz'] }))
    },
    {
      description: 'Bad Request - Invalid input or validation error',
      examples: [
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'URL is required' },
          requestId: 'req_abc123xyz'
        }
      ]
    }
  ),

  401: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Union([
          t.Literal('UNAUTHORIZED'),
          t.Literal('INVALID_PASSWORD'),
          t.Literal('PASSWORD_REQUIRED')
        ]),
        message: t.String({
          examples: ['Authentication required', 'Invalid password']
        })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description:
        'Unauthorized - Authentication required or invalid credentials',
      examples: [
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        }
      ]
    }
  ),

  403: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Union([
          t.Literal('FORBIDDEN'),
          t.Literal('EMAIL_VERIFICATION_REQUIRED'),
          t.Literal('2FA_REQUIRED'),
          t.Literal('QUOTA_EXCEEDED')
        ]),
        message: t.String({
          examples: ['Access denied', 'Email verification required']
        })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description:
        'Forbidden - Insufficient permissions or verification required',
      examples: [
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource'
          }
        }
      ]
    }
  ),

  404: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Union([
          t.Literal('NOT_FOUND'),
          t.Literal('LINK_NOT_FOUND'),
          t.Literal('USER_NOT_FOUND'),
          t.Literal('SESSION_NOT_FOUND')
        ]),
        message: t.String({ examples: ['Link not found', 'User not found'] })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Not Found - Resource does not exist',
      examples: [
        {
          success: false,
          error: { code: 'LINK_NOT_FOUND', message: 'Link not found' }
        }
      ]
    }
  ),

  402: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('QUOTA_EXCEEDED'),
        message: t.String({
          examples: [
            'You have reached your link quota. Upgrade your plan to create more links.'
          ]
        })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Payment Required - Quota Exceeded',
      examples: [
        {
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message:
              'You have reached your link quota. Upgrade your plan to create more links.'
          }
        }
      ]
    }
  ),

  409: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Union([
          t.Literal('REQUEST_ALREADY_EXISTS'),
          t.Literal('CONFLICT')
        ]),
        message: t.String({
          examples: ['A deletion request already exists', 'Resource conflict']
        }),
        details: t.Optional(t.Unknown())
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Conflict - Resource already exists or operation conflicts',
      examples: [
        {
          success: false,
          error: { code: 'CONFLICT', message: 'Custom alias already in use' }
        }
      ]
    }
  ),

  410: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('LINK_EXPIRED'),
        message: t.String({ examples: ['This link has expired'] })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Gone - Link has expired',
      examples: [
        {
          success: false,
          error: {
            code: 'LINK_EXPIRED',
            message: 'This link expired on 2026-01-01T00:00:00Z'
          }
        }
      ]
    }
  ),

  421: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('REDIRECT_LOOP'),
        message: t.String({ examples: ['Redirect depth exceeded (max: 3)'] })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Misdirected Request - Redirect loop detected',
      examples: [
        {
          success: false,
          error: {
            code: 'REDIRECT_LOOP',
            message: 'Redirect depth exceeded (max: 3)'
          }
        }
      ]
    }
  ),

  422: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Union([
          t.Literal('URL_MALICIOUS'),
          t.Literal('VALIDATION_ERROR'),
          t.Literal('INVALID_URL'),
          t.Literal('SHORTENER_BLOCKED')
        ]),
        message: t.String({
          examples: [
            'URL detected as malicious',
            'Invalid URL format',
            'URLs from other shorteners are not allowed'
          ]
        })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Unprocessable Entity - URL validation failed',
      examples: [
        {
          success: false,
          error: {
            code: 'URL_MALICIOUS',
            message: 'URL detected as potentially malicious'
          }
        }
      ]
    }
  ),

  429: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('RATE_LIMITED'),
        message: t.String({
          examples: ['Too many requests, please try again later']
        }),
        retryAfter: t.Optional(
          t.Number({
            description: 'Seconds until retry allowed',
            examples: [60]
          })
        )
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Too Many Requests - Rate limit exceeded',
      examples: [
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
            retryAfter: 60
          }
        }
      ]
    }
  ),

  451: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('LINK_BANNED'),
        message: t.String({
          examples: ['This link has been banned for violating terms of service']
        })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description:
        'Unavailable For Legal Reasons - Link banned for TOS violation',
      examples: [
        {
          success: false,
          error: {
            code: 'LINK_BANNED',
            message: 'This link has been banned for violating terms of service'
          }
        }
      ]
    }
  ),

  500: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: t.Literal('INTERNAL_ERROR'),
        message: t.String({ examples: ['Internal server error'] })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Internal Server Error',
      examples: [
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          },
          requestId: 'req_abc123xyz'
        }
      ]
    }
  )
} as const;

// ═══════════════════════════════════════════════════════════════════
// ELYSIA MODEL PLUGIN (for t.Ref usage)
// ═══════════════════════════════════════════════════════════════════

export const ResponseModels = new Elysia({ name: 'response.models' }).model({
  'response.error': ErrorResponse,
  'response.error.400': CommonErrors[400],
  'response.error.401': CommonErrors[401],
  'response.error.402': CommonErrors[402],
  'response.error.403': CommonErrors[403],
  'response.error.404': CommonErrors[404],
  'response.error.409': CommonErrors[409],
  'response.error.410': CommonErrors[410],
  'response.error.421': CommonErrors[421],
  'response.error.422': CommonErrors[422],
  'response.error.429': CommonErrors[429],
  'response.error.451': CommonErrors[451],
  'response.error.500': CommonErrors[500]
});
