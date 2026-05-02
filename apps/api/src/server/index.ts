/**
 * ═════════════════════════════════════════════════════════════════════
 * MAIN API ROUTER - urlfy.cc
 * ═════════════════════════════════════════════════════════════════════
 * Consolidated router for all API endpoints
 * All routes implemented in src/server/modules
 * ═════════════════════════════════════════════════════════════════════
 */

import { openapi, toOpenAPISchema } from '@elysiajs/openapi';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { elysiaLogger } from '@logtape/elysia';
import { Elysia } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import { auth } from '@/lib/auth';
import { buildCspDirectives } from '@/lib/csp';
import { getCorsHeaders } from '@/server/config/cors';
// Plugins
import { bearerPlugin, jwtPlugin } from '@/server/config/plugins';
import { SECURITY_HEADERS } from '@/server/config/security';
import { generateCspNonce } from '@/server/lib/csp-nonce';
import { ErrorCode, isAppError } from '@/server/lib/error-handler';
import { shouldSkipHttpLog } from '@/server/lib/http-log';
import { getClientIp } from '@/server/lib/ip';
import { getMergedOpenAPISpec } from '@/server/lib/openapi-merger';
import { ResponseModels } from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import {
  antiAbuseMiddleware,
  recordLoginFailure
} from '@/server/middleware/anti-abuse';
import { compressionMiddleware } from '@/server/middleware/compression';
import { handleCORSPreflight } from '@/server/middleware/cors';
import { cspMiddleware } from '@/server/middleware/csp.middleware';
import {
  buildErrorEnvelope,
  getOrCreateRequestId
} from '@/server/middleware/error-response';
import { rateLimit } from '@/server/middleware/rate-limit';
import { securityHeadersMiddleware } from '@/server/middleware/security-headers';
// Feature-based modules
import {
  AdminModel,
  adminController,
  adminMessagesController,
  adminQueuesController,
  auditController
} from '@/server/modules/admin';
import {
  AnalyticsModel,
  analyticsController
} from '@/server/modules/analytics';
import { ApiKeysModel, apiKeysController } from '@/server/modules/api-keys';
import { AuthModel, authController } from '@/server/modules/auth';
import { contactController } from '@/server/modules/contact';
import {
  healthController,
  InternalModel,
  internalController
} from '@/server/modules/internal';
import { LinksModel, linksController } from '@/server/modules/links';
import { publicApiV1 } from '@/server/modules/public';
import {
  consentController,
  meController,
  UsersModel
} from '@/server/modules/users';

const logger = createLogger('api-router');

/**
 * Error codes whose `details` must never reach the client (internal 5xx).
 * Any AppError carrying one of these codes will have its details logged
 * server-side but stripped from the JSON response body.
 */
const INTERNAL_ERROR_CODES: ReadonlySet<string> = new Set([
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.DATABASE_ERROR,
  ErrorCode.CACHE_ERROR,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.DATABASE_UNAVAILABLE
]);

/**
 * OpenAPI server list — in production only the canonical URL is exposed so
 * the Scalar UI does not pre-populate a localhost address for external users.
 */
const openApiServers =
  process.env.NODE_ENV === 'production'
    ? [{ url: 'https://urlfy.cc/api', description: 'Production server' }]
    : [
        { url: 'http://localhost:3000/api', description: 'Development server' },
        { url: 'https://urlfy.cc/api', description: 'Production server' }
      ];

const completeOpenApiSecurity: OpenAPIV3.SecurityRequirementObject[] = [
  { bearerAuth: [] },
  { cookieAuth: [] },
  { apiKeyAuth: [] }
];

type CompleteOpenApiDocumentation = Pick<
  OpenAPIV3.Document,
  'info' | 'servers' | 'tags' | 'components' | 'security'
>;

const completeOpenApiDocumentation: CompleteOpenApiDocumentation = {
  info: {
    title: 'urlfy.cc Complete API',
    version: '1.0.0',
    description:
      'Comprehensive API documentation including link management, analytics, authentication (Better-Auth), and admin endpoints',
    contact: {
      name: 'API Support',
      email: 'support@urlfy.cc'
    }
  },
  servers: openApiServers,
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: '2FA', description: 'Two-factor authentication' },
    { name: 'Sessions', description: 'Session management' },
    { name: 'API Keys', description: 'API key management' },
    {
      name: 'Public API V1 - Links',
      description: 'Public API V1 link endpoints'
    },
    { name: 'Users', description: 'User profile and data' },
    { name: 'Links', description: 'Link management and shortening' },
    { name: 'Contact', description: 'Contact form submissions' },
    { name: 'Admin', description: 'Admin-only endpoints' },
    { name: 'Stats', description: 'Statistics and analytics' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT session token from Better-Auth'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'urlfy.session',
        description: 'Session cookie (automatically set by Better-Auth)'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for programmatic access (format: urlfy_sk_...)'
      }
    }
  },
  security: completeOpenApiSecurity
};

const completeOpenApiExclude: {
  paths: Array<string | RegExp>;
  methods: string[];
  staticFile: boolean;
} = {
  paths: [
    /^\/auth(?:\/|$)/,
    /^\/internal\/docs(?:\/|$)/,
    /^\/internal\/openapi(?:\/|$)/,
    /^\/docs/,
    '/*'
  ],
  methods: ['options', 'head'],
  staticFile: true
} as const;

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API DOCS (ISOLATED INSTANCE)
// ═══════════════════════════════════════════════════════════════════

const publicDocsApp = new Elysia()
  .use(cspMiddleware)
  .use(securityHeadersMiddleware)
  .use(ResponseModels)
  .use(
    openapi({
      documentation: {
        info: {
          title: 'urlfy.cc Public API',
          version: '1.0.0',
          description:
            'Public API documentation for programmatic access (v1 only)',
          contact: {
            name: 'API Support',
            email: 'support@urlfy.cc'
          }
        },
        servers: openApiServers,
        tags: [
          {
            name: 'Public API V1 - Links',
            description: 'Public API V1 link endpoints'
          }
        ],
        components: {
          securitySchemes: {
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
              description:
                'API key for programmatic access (format: urlfy_sk_...)'
            }
          }
        },
        security: [{ apiKeyAuth: [] }]
      },
      path: '/docs',
      exclude: {
        paths: ['/docs*']
      },
      scalar: {
        url: '/api/docs/json',
        defaultHttpClient: {
          targetKey: 'javascript',
          clientKey: 'fetch'
        },
        servers: openApiServers
      },
      embedSpec: true
    })
  )
  .use(publicApiV1);

// ═══════════════════════════════════════════════════════════════════
// MAIN API INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const api = new Elysia({ prefix: '/api' })
  // ═══════════════════════════════════════════════════════════════════
  // OBSERVABILITY - Must be FIRST to capture full request lifecycle
  // ═══════════════════════════════════════════════════════════════════
  .use(
    opentelemetry({
      // Automatically uses the global SDK initialized during apps/api startup
      // No need to pass spanProcessors or exporters - they are inherited
    })
  )

  // HTTP Request logging via LogTape (@logtape/elysia)
  .use(
    elysiaLogger({
      category: ['urlfy', 'http'],
      level: 'info',
      format: 'short',
      skip: shouldSkipHttpLog
    })
  )

  // Core plugins (JWT, CORS, Bearer, Compression, CSP, Security Headers)
  .use(jwtPlugin)
  .use(bearerPlugin)
  .use(compressionMiddleware())
  .use(cspMiddleware)
  .use(securityHeadersMiddleware)

  // Register models for OpenAPI $ref support and type inference
  .use(ResponseModels)
  .use(LinksModel)
  .use(AuthModel)
  .use(UsersModel)
  .use(AnalyticsModel)
  .use(AdminModel)
  .use(ApiKeysModel)
  .use(InternalModel)

  // OpenAPI Documentation (Complete API)
  .use(
    openapi({
      documentation: completeOpenApiDocumentation,
      path: '/internal/docs',
      exclude: completeOpenApiExclude,
      scalar: {
        url: '/api/internal/docs/merged.json',
        defaultHttpClient: {
          targetKey: 'javascript',
          clientKey: 'fetch'
        },
        servers: openApiServers
      },
      embedSpec: true
    })
  )

  // ── Edge protection and request context ─────────────────────────
  // Register lifecycle hooks before any mounts/routes so every public
  // /api/* entrypoint is covered consistently.
  .derive(({ request }) => {
    const requestId =
      request.headers.get('x-request-id') ||
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return { requestId };
  })

  .onBeforeHandle(({ request }) => {
    return handleCORSPreflight(request);
  })

  .onBeforeHandle(async ({ request, set }) => {
    const abuseResult = await antiAbuseMiddleware(request);
    if (abuseResult) return abuseResult;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult.response) return rateLimitResult.response;

    // Attach rate-limit headers so they flow into the final response
    if (rateLimitResult.headers) {
      rateLimitResult.headers.forEach((value, key) => {
        set.headers[key] = value;
      });
    }
  })

  .onBeforeHandle(({ request, set }) => {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && !apiKey.startsWith('urlfy_sk_')) {
      const requestId = getOrCreateRequestId(request);
      set.status = 401;
      set.headers['x-request-id'] = requestId;
      set.headers['content-type'] = 'application/json; charset=utf-8';
      return buildErrorEnvelope(
        'UNAUTHORIZED',
        'Invalid API key format',
        requestId
      );
    }
  })

  .onAfterHandle(({ set, request, requestId, response }) => {
    const nonce = generateCspNonce();
    const csp = buildCspDirectives({
      nonce,
      isProduction: process.env.NODE_ENV === 'production'
    });
    const corsHeaders = getCorsHeaders(request.headers.get('origin'));

    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      set.headers[key.toLowerCase()] = value;
    });

    Object.entries(corsHeaders).forEach(([key, value]) => {
      set.headers[key.toLowerCase()] = value;
    });

    set.headers['content-security-policy'] = csp;
    set.headers['x-csp-nonce'] = nonce;
    set.headers['x-request-id'] = requestId ?? getOrCreateRequestId(request);

    // Record login failures so the anti-abuse service can auto-block repeat offenders.
    // Works for both Elysia-defined routes (set.status) and the Better-Auth mount (Response).
    if (request.method === 'POST') {
      const path = new URL(request.url).pathname;
      if (path.includes('/auth/sign-in')) {
        const status =
          response instanceof Response
            ? response.status
            : typeof set.status === 'number'
              ? set.status
              : 0;
        if (status === 401 || status === 403) {
          const ip = getClientIp(request);
          recordLoginFailure(ip).catch(() => {});
        }
      }
    }
  })

  // Merged OpenAPI spec endpoint (includes Better-Auth)
  .get(
    '/internal/docs/merged.json',
    async () => {
      const getElysiaSpec = async (): Promise<OpenAPIV3.Document> => {
        const elysiaSpecResponse = await api.handle(
          new Request('http://localhost/api/internal/docs/json')
        );
        return (await elysiaSpecResponse.json()) as OpenAPIV3.Document;
      };

      return await getMergedOpenAPISpec(getElysiaSpec);
    },
    {
      detail: {
        summary: 'Get merged OpenAPI specification',
        description:
          'Returns the complete OpenAPI spec including Elysia and Better-Auth endpoints',
        tags: ['Documentation'],
        security: []
      }
    }
  )

  // Better-Auth routes (mount handler directly)
  // Better-Auth has basePath: '/auth', Elysia has prefix: '/api'
  // Result: /api/auth/session, /api/auth/sign-in, etc.
  .mount(auth.handler)

  // Public API Docs (proxy to isolated instance)
  .all(
    '/docs*',
    ({ request }) => {
      const url = new URL(request.url);
      const proxiedPath = url.pathname.replace(/^\/api/, '') + url.search;
      return publicDocsApp.handle(
        new Request(`http://localhost${proxiedPath}`, request)
      );
    },
    {
      detail: {
        hide: true
      }
    }
  )

  // API Routes
  .group('', (app) =>
    app
      .use(healthController)
      .use(internalController)
      .use(authController)
      .use(meController)
      .use(consentController)
      .use(apiKeysController)
      .use(contactController)
      .use(linksController)
      .use(analyticsController)
      .use(adminController)
      .use(adminMessagesController)
      .use(adminQueuesController)
      .use(auditController)
  )

  // Public API v1
  .use(publicApiV1)

  // Consistent JSON fallback for unknown API routes.
  .all('/*', ({ request, set, requestId }) => {
    const resolvedRequestId = requestId ?? getOrCreateRequestId(request);

    set.status = 404;
    set.headers['x-request-id'] = resolvedRequestId;
    set.headers['content-type'] = 'application/json; charset=utf-8';

    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      },
      requestId: resolvedRequestId
    };
  })

  // Global error handler
  .onError(({ code, error, set, request, requestId }) => {
    const resolvedRequestId = requestId ?? getOrCreateRequestId(request);

    set.headers['x-request-id'] = resolvedRequestId;
    set.headers['content-type'] = 'application/json; charset=utf-8';

    if (isAppError(error)) {
      const isInternalCode = INTERNAL_ERROR_CODES.has(error.code);

      // Always log internal error details server-side for debugging
      if (isInternalCode && error.details) {
        logger.error('Internal AppError details (redacted from response)', {
          requestId: resolvedRequestId,
          code: error.code,
          details: error.details
        });
      }

      set.status = error.status;
      return {
        success: false,
        error: {
          code: error.code,
          message: isInternalCode ? 'Internal server error' : error.message,
          // Never expose details for internal/server-side errors
          ...(!isInternalCode && error.details && { details: error.details })
        },
        requestId: resolvedRequestId
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        },
        requestId: resolvedRequestId
      };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message || 'Validation failed',
          details: error.all || undefined
        },
        requestId: resolvedRequestId
      };
    }

    // Log error with request ID for correlation (redact stack in production)
    logger.error('API Error', {
      requestId: resolvedRequestId,
      error: error instanceof Error ? error.message : String(error),
      ...(process.env.NODE_ENV === 'development' && {
        stack: error instanceof Error ? error.stack : undefined
      })
    });

    set.status = 500;
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      },
      requestId: resolvedRequestId
    };
  });

export function getElysiaOpenApiSpec(): OpenAPIV3.Document {
  const { paths, components } = toOpenAPISchema(api, completeOpenApiExclude);
  const generatedComponents = (components ?? {}) as OpenAPIV3.ComponentsObject;

  return {
    openapi: '3.0.3',
    ...completeOpenApiDocumentation,
    paths,
    components: {
      ...generatedComponents,
      securitySchemes: {
        ...(completeOpenApiDocumentation.components?.securitySchemes ?? {}),
        ...(generatedComponents.securitySchemes ?? {})
      }
    }
  };
}

// Export type for Eden inference
export type App = typeof api;
