/**
 * ═════════════════════════════════════════════════════════════════════
 * MAIN API ROUTER - urlfy.cc
 * ═════════════════════════════════════════════════════════════════════
 * Consolidated router for all API endpoints
 * All routes implemented in src/server/modules
 * ═════════════════════════════════════════════════════════════════════
 */

import { auth } from '@/lib/auth';
import { openapi } from '@elysiajs/openapi';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { Elysia } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
// Plugins
import { bearerPlugin, corsPlugin, jwtPlugin } from '@/server/config/plugins';
import { isAppError } from '@/server/lib/error-handler';
import { getMergedOpenAPISpec } from '@/server/lib/openapi-merger';
import { ResponseModels } from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { compressionMiddleware } from '@/server/middleware/compression';
import { cspMiddleware } from '@/server/middleware/csp.middleware';
import { errorMiddleware } from '@/server/middleware/error.middleware';
import { securityHeadersMiddleware } from '@/server/middleware/security-headers';
// Feature-based modules
import {
  AdminModels,
  adminController,
  adminMessagesController,
  auditController
} from '@/server/modules/admin';
import { adminQueuesController } from '@/server/modules/admin/queues.controller';
import {
  AnalyticsModel,
  analyticsController
} from '@/server/modules/analytics';
import { ApiKeysModel, apiKeysController } from '@/server/modules/api-keys';
import { AuthModels, authController } from '@/server/modules/auth';
import { contactController } from '@/server/modules/contact';
import {
  InternalModel,
  healthController,
  internalController
} from '@/server/modules/internal';
import { LinksModel, linksController } from '@/server/modules/links';
import { publicApiV1 } from '@/server/modules/public';
import {
  UsersModel,
  consentController,
  meController,
  usersController
} from '@/server/modules/users';

const logger = createLogger('api-router');

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API DOCS (ISOLATED INSTANCE)
// ═══════════════════════════════════════════════════════════════════

const publicDocsApp = new Elysia()
  .use(compressionMiddleware())
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
        servers: [
          {
            url: 'http://localhost:3000/api',
            description: 'Development server'
          },
          {
            url: 'https://urlfy.cc/api',
            description: 'Production server'
          }
        ],
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
        servers: [
          {
            url: 'http://localhost:3000/api',
            description: 'Development server'
          },
          {
            url: 'https://urlfy.cc/api',
            description: 'Production server'
          }
        ]
      }
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
      // Automatically uses the global SDK initialized in src/server/lib/telemetry.ts
      // No need to pass spanProcessors or exporters - they are inherited
    })
  )

  // Error handling
  .use(errorMiddleware)

  // Core plugins (JWT, CORS, Bearer, Compression, CSP, Security Headers)
  .use(jwtPlugin)
  .use(corsPlugin)
  .use(bearerPlugin)
  .use(compressionMiddleware())
  .use(cspMiddleware)
  .use(securityHeadersMiddleware)

  // Register models for OpenAPI $ref support and type inference
  .use(ResponseModels)
  .use(LinksModel)
  .use(AuthModels)
  .use(UsersModel)
  .use(AnalyticsModel)
  .use(AdminModels)
  .use(ApiKeysModel)
  .use(InternalModel)

  // OpenAPI Documentation (Complete API)
  .use(
    openapi({
      documentation: {
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
        servers: [
          {
            url: 'http://localhost:3000/api',
            description: 'Development server'
          },
          {
            url: 'https://urlfy.cc/api',
            description: 'Production server'
          }
        ],
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
              description:
                'API key for programmatic access (format: urlfy_sk_...)'
            }
          }
        },
        security: [{ bearerAuth: [] }, { cookieAuth: [] }, { apiKeyAuth: [] }]
      },
      path: '/internal/docs',
      exclude: {
        paths: ['/auth/*', '/internal/docs/*', '/docs/*']
      },
      scalar: {
        url: '/api/internal/docs/merged.json',
        defaultHttpClient: {
          targetKey: 'javascript',
          clientKey: 'fetch'
        },
        servers: [
          {
            url: 'http://localhost:3000/api',
            description: 'Development server'
          },
          {
            url: 'https://urlfy.cc/api',
            description: 'Production server'
          }
        ]
      }
    })
  )

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
      .use(authController)
      .use(meController)
      .use(consentController)
      .use(usersController)
      .use(apiKeysController)
      .use(contactController)
      .use(linksController)
      .use(analyticsController)
      .use(internalController)
      .use(adminController)
      .use(adminMessagesController)
      .use(adminQueuesController)
      .group('/admin', (admin) => admin.use(auditController))
  )

  // Public API v1
  .use(publicApiV1)

  // API key format validation
  .onBeforeHandle(({ request, set }) => {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && !apiKey.startsWith('urlfy_sk_')) {
      set.status = 401;
      return {
        success: false as const,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key format'
        }
      };
    }
  })

  // Add request ID to all requests
  .derive(({ request }) => {
    const requestId =
      request.headers.get('x-request-id') ||
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return { requestId };
  })

  // Set response header with request ID
  .onAfterHandle(({ set, requestId }) => {
    set.headers['x-request-id'] = requestId;
  })

  // Global error handler
  .onError(({ code, error, set, requestId }) => {
    set.headers['x-request-id'] = requestId;

    if (isAppError(error)) {
      set.status = error.status;
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details })
        },
        requestId
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
        requestId
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
        requestId
      };
    }

    // Log error with request ID for correlation
    logger.error('API Error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    set.status = 500;
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : 'Internal server error'
      },
      requestId
    };
  });

// Export type for Eden inference
export type App = typeof api;
