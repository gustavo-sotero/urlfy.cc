import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { auth } from '@/lib/auth';
import { healthRoutes } from './health';
import { adminAuditRoutes } from './v1/admin/audit';
import { analyticsRoutes } from './v1/analytics/index';
import { apiKeysRoutes } from './v1/auth/api-keys';
import { authRoutes } from './v1/auth/index';
import { linksRouter } from './v1/links/index';
import { usersRoutes } from './v1/users/index';
import { userDataRoutes } from './v1/users/me';

// ═══════════════════════════════════════════════════════════════════
// API PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export const api = new Elysia({ prefix: '/api' })
  // OpenAPI/Swagger Documentation
  .use(
    swagger({
      documentation: {
        info: {
          title: 'urlfy.cc API',
          version: '1.0.0',
          description:
            'High-performance URL shortener with analytics and API access',
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
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: '2FA', description: 'Two-factor authentication' },
          { name: 'Sessions', description: 'Session management' },
          { name: 'API Keys', description: 'API key management' },
          { name: 'Users', description: 'User profile and data' },
          { name: 'Links', description: 'Link management and shortening' },
          { name: 'Admin', description: 'Admin-only endpoints' },
          { name: 'Stats', description: 'Statistics and analytics' },
          { name: 'LGPD/GDPR', description: 'Data compliance endpoints' }
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
      path: '/api/v1/docs',
      exclude: ['/api/auth/*', '/api/v1/docs', '/api/v1/docs/json']
    })
  )

  // Better-Auth routes (must be first, as it handles /api/auth/*)
  .all('/auth/*', ({ request }) => auth.handler(request))

  // Health check
  .use(healthRoutes)

  // API v1 routes
  .group('/v1', (app) =>
    app
      .use(authRoutes)
      .use(apiKeysRoutes)
      .use(userDataRoutes)
      .use(usersRoutes)
      .use(linksRouter)
      .use(analyticsRoutes)
      // Admin routes
      .group('/admin', (admin) => admin.use(adminAuditRoutes))
  )

  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      };
    }

    // Log error
    console.error('API Error:', error);

    set.status = 500;
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : 'Internal server error'
      }
    };
  });
