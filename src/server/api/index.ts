import { auth } from '@/lib/auth';
import { getMergedOpenAPISpec } from '@/server/lib/openapi-merger';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
// Import response models
import { ResponseModels } from '@/server/lib/response.schema';
// Import from feature-based modules
import { AdminModels, adminController } from '@/server/modules/admin';
import {
  AnalyticsModel,
  analyticsController
} from '@/server/modules/analytics';
import { AuthModels, authController } from '@/server/modules/auth';
import { LinksModel, linksController } from '@/server/modules/links';
import { UsersModel, usersController } from '@/server/modules/users';
import { adminAuditRoutes } from './admin/audit';
import { healthRoutes } from './health';
import { consentRoutes, userDataRoutes } from './users/me';

// ═══════════════════════════════════════════════════════════════════
// API PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export const api = new Elysia({ prefix: '/api' })
  // Register all models FIRST for OpenAPI $ref support
  .use(ResponseModels)
  .use(LinksModel)
  .use(AuthModels)
  .use(UsersModel)
  .use(AnalyticsModel)
  .use(AdminModels)

  // OpenAPI Documentation - Scalar UI will be configured to use merged spec
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
            url: 'http://localhost:3000',
            description: 'Development server'
          },
          {
            url: 'https://urlfy.cc',
            description: 'Production server'
          }
        ],
        tags: [
          { name: 'Health', description: 'Health check endpoints' },
          {
            name: 'Better-Auth',
            description:
              'Better-Auth authentication and authorization endpoints'
          },
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: '2FA', description: 'Two-factor authentication' },
          { name: 'Sessions', description: 'Session management' },
          { name: 'API Keys', description: 'API key management' },
          { name: 'Users', description: 'User profile and data' },
          { name: 'Links', description: 'Link management and shortening' },
          { name: 'Admin', description: 'Admin-only endpoints' },
          { name: 'Stats', description: 'Statistics and analytics' },
          { name: 'LGPD/GDPR', description: 'Data compliance endpoints' },
          { name: 'Documentation', description: 'API documentation endpoints' }
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
        paths: ['/auth/*', '/docs/merged.json']
      },
      // Configure Scalar UI to use merged spec (includes Better-Auth endpoints)
      scalar: {
        url: '/api/docs/merged.json'
      }
    })
  )

  // Merged OpenAPI spec endpoint
  .get(
    '/docs/merged.json',
    async () => {
      // Get Elysia spec from the openapi plugin
      const getElysiaSpec = async (): Promise<OpenAPIV3.Document> => {
        // Access the swagger JSON endpoint internally
        const elysiaSpecResponse = await api.handle(
          new Request('http://localhost/api/internal/docs/json')
        );
        return (await elysiaSpecResponse.json()) as OpenAPIV3.Document;
      };

      const mergedSpec = await getMergedOpenAPISpec(getElysiaSpec);
      return mergedSpec;
    },
    {
      detail: {
        summary: 'Get merged OpenAPI specification',
        description:
          'Returns the complete OpenAPI spec including Elysia and Better-Auth endpoints',
        tags: ['Documentation'],
        security: [] // Public endpoint
      }
    }
  )

  // Better-Auth routes (must be first, as it handles /api/auth/*)
  .all('/auth/*', ({ request }) => auth.handler(request))

  // Health check

  // API v1 routes
  .group('', (app) =>
    app
      .use(healthRoutes)
      .use(authController)
      .use(userDataRoutes)
      .use(consentRoutes)
      .use(usersController)
      .use(linksController)
      .use(analyticsController)
      // Admin routes
      .use(adminController)
      .group('/admin', (admin) => admin.use(adminAuditRoutes))
  )

  // Add request ID to all responses
  .derive(({ request }) => {
    const requestId =
      request.headers.get('x-request-id') ||
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return { requestId };
  })

  // Set response header with request ID
  .onAfterHandle(({ set, requestId }) => {
    set.headers['x-request-id'] = requestId;
  })

  .onError(({ code, error, set, requestId }) => {
    // Add request ID to error response headers
    set.headers['x-request-id'] = requestId;

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
    console.error('API Error:', { requestId, error });

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
