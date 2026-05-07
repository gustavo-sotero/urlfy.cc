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
import { ErrorCode } from './error-handler';

const FRAMEWORK_NOT_FOUND = 'NOT_FOUND' as const;

const STATUS_ERROR_CODES = {
  400: [
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.INVALID_URL,
    ErrorCode.INVALID_INPUT,
    ErrorCode.SHORTENER_NOT_ALLOWED,
    ErrorCode.URL_TOO_LONG
  ],
  401: [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.PASSWORD_REQUIRED,
    ErrorCode.INVALID_PASSWORD,
    ErrorCode.INVALID_CREDENTIALS,
    ErrorCode.SESSION_EXPIRED
  ],
  402: [ErrorCode.QUOTA_EXCEEDED],
  403: [
    ErrorCode.FORBIDDEN,
    ErrorCode.EMAIL_VERIFICATION_REQUIRED,
    ErrorCode.ADMIN_REQUIRED,
    ErrorCode.ADMIN_SESSION_EXPIRED,
    ErrorCode.INSUFFICIENT_PERMISSIONS
  ],
  404: [
    FRAMEWORK_NOT_FOUND,
    ErrorCode.LINK_NOT_FOUND,
    ErrorCode.USER_NOT_FOUND,
    ErrorCode.RESOURCE_NOT_FOUND
  ],
  409: [
    ErrorCode.ALIAS_TAKEN,
    ErrorCode.SLUG_RESERVED,
    ErrorCode.DUPLICATE_ENTRY
  ],
  410: [
    ErrorCode.LINK_EXPIRED,
    ErrorCode.LINK_DELETED,
    ErrorCode.MAX_CLICKS_REACHED
  ],
  421: [ErrorCode.REDIRECT_LOOP],
  422: [
    ErrorCode.URL_MALICIOUS,
    ErrorCode.URL_BLOCKED,
    ErrorCode.IDEMPOTENCY_CONFLICT
  ],
  429: [ErrorCode.RATE_LIMITED],
  451: [ErrorCode.LINK_BANNED, ErrorCode.CONTENT_BANNED],
  500: [
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.CACHE_ERROR
  ],
  503: [ErrorCode.SERVICE_UNAVAILABLE, ErrorCode.DATABASE_UNAVAILABLE]
} as const;

function uniqueErrorCodes(codes: readonly string[]): string[] {
  return [...new Set(codes)];
}

function errorCodeSchema(codes: readonly string[]): TSchema {
  const uniqueCodes = uniqueErrorCodes(codes);
  const literals = uniqueCodes.map((code) => t.Literal(code));

  if (literals.length === 1) {
    return literals[0];
  }

  return t.Union(literals as unknown as [TSchema, TSchema, ...TSchema[]]);
}

const documentedErrorCodes = uniqueErrorCodes(
  Object.values(STATUS_ERROR_CODES).flatMap((codes) => [...codes])
);

// ═══════════════════════════════════════════════════════════════════
// ERROR CODES ENUM (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════

/**
 * All possible error codes used in the API.
 */
export const ErrorCodes = t.Union(
  documentedErrorCodes.map((code) => t.Literal(code)) as unknown as [
    TSchema,
    TSchema,
    ...TSchema[]
  ],
  { description: 'Standard API error codes' }
);

export const ApiError = t.Object(
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
);

export const PaginationMeta = t.Object(
  {
    total: t.Number({
      description: 'Total number of items',
      examples: [100]
    }),
    page: t.Number({ description: 'Current page number', examples: [1] }),
    perPage: t.Number({ description: 'Items per page', examples: [20] }),
    lastPage: t.Number({ description: 'Last page number', examples: [5] }),
    hasMore: t.Boolean({
      description: 'Whether there are more pages',
      examples: [true]
    }),
    nextCursor: t.Optional(
      t.String({
        description:
          'Opaque cursor to pass as cursor query param for the next page',
        examples: ['eyJpZCI6IjU1MGU4NDAwIiwidmFsIjoiMjAyNi0wMS0wMSJ9']
      })
    )
  },
  { description: 'Pagination metadata' }
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
  },
  503: {
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable'
    },
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
      meta: PaginationMeta
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
                  hasMore: true,
                  nextCursor: 'eyJpZCI6IjU1MGU4NDAwIiwidmFsIjoiMjAyNi0wMS0wMSJ9'
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
    error: ApiError,
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
        code: errorCodeSchema(STATUS_ERROR_CODES[400]),
        message: t.String({
          examples: ['Invalid input data', 'URL format is invalid']
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
        code: errorCodeSchema(STATUS_ERROR_CODES[401]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[403]),
        message: t.String({
          examples: [
            'Access denied',
            'Admin access requires a recent GitHub sign-in'
          ]
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
        code: errorCodeSchema(STATUS_ERROR_CODES[404]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[402]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[409]),
        message: t.String({
          examples: ['Custom alias already in use', 'Duplicate entry']
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
          error: {
            code: 'ALIAS_TAKEN',
            message: 'Custom alias already in use'
          }
        }
      ]
    }
  ),

  410: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: errorCodeSchema(STATUS_ERROR_CODES[410]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[421]),
        message: t.String({
          examples: ['Self-shortener redirect loop detected']
        })
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
            message: 'Self-shortener redirect loop detected'
          }
        }
      ]
    }
  ),

  422: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: errorCodeSchema(STATUS_ERROR_CODES[422]),
        message: t.String({
          examples: [
            'URL detected as malicious',
            'URL detected as potentially malicious',
            'URL is blocked by policy'
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
        code: errorCodeSchema(STATUS_ERROR_CODES[429]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[451]),
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
        code: errorCodeSchema(STATUS_ERROR_CODES[500]),
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
  ),

  503: t.Object(
    {
      success: t.Literal(false, { default: false }),
      error: t.Object({
        code: errorCodeSchema(STATUS_ERROR_CODES[503]),
        message: t.String({ examples: ['Service temporarily unavailable'] })
      }),
      requestId: t.Optional(t.String())
    },
    {
      description: 'Service Unavailable - Dependent service is down',
      examples: [
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable'
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
  'response.api-error': ApiError,
  'response.error': ErrorResponse,
  'response.pagination': PaginationMeta,
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
  'response.error.500': CommonErrors[500],
  'response.error.503': CommonErrors[503]
});
