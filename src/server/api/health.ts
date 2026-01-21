import { Elysia, t } from 'elysia';
import { checkDatabaseHealth } from '@/db';
import { checkQueueHealth } from '../lib/queue';
import { checkRedisHealth } from '../lib/redis';
import { requireAdmin } from '../middleware/auth.middleware';

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK SIMPLES (público)
// ═══════════════════════════════════════════════════════════════════

const healthSimple = new Elysia()
  .get(
    '/health',
    async () => {
      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString()
      };
    },
    {
      detail: {
        summary: 'Simple health check',
        description: 'Returns basic health status',
        tags: ['Health'],
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: t.Object(
          {
            status: t.Literal('ok', { examples: ['ok'] }),
            timestamp: t.String({
              format: 'date-time',
              examples: ['2026-01-06T12:00:00Z']
            })
          },
          {
            description: 'Service is healthy',
            examples: [{ status: 'ok', timestamp: '2026-01-06T12:00:00Z' }]
          }
        )
      }
    }
  )
  .get(
    '/health/ready',
    async ({ set }) => {
      const [dbHealth, redisHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth()
      ]);

      const isReady = dbHealth.status === 'ok' && redisHealth.status === 'ok';

      if (!isReady) {
        set.status = 503;
      }

      return {
        status: isReady ? ('ready' as const) : ('not_ready' as const),
        services: {
          database: dbHealth.status,
          redis: redisHealth.status
        }
      };
    },
    {
      detail: {
        summary: 'Readiness check',
        description: 'Checks if all required services are available',
        tags: ['Health'],
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: t.Object(
          {
            status: t.Union([t.Literal('ready'), t.Literal('not_ready')]),
            services: t.Object({
              database: t.String({ examples: ['ok'] }),
              redis: t.String({ examples: ['ok'] })
            })
          },
          {
            description: 'All services ready',
            examples: [
              { status: 'ready', services: { database: 'ok', redis: 'ok' } }
            ]
          }
        ),
        503: t.Object(
          {
            status: t.Literal('not_ready'),
            services: t.Object({
              database: t.String({ examples: ['error'] }),
              redis: t.String({ examples: ['ok'] })
            })
          },
          {
            description: 'One or more services unavailable',
            examples: [
              {
                status: 'not_ready',
                services: { database: 'error', redis: 'ok' }
              }
            ]
          }
        )
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK DETALHADO (admin only)
// ═══════════════════════════════════════════════════════════════════

const healthDetailed = new Elysia().use(requireAdmin).get(
  '/health/detailed',
  async () => {
    const startTime = performance.now();

    const [dbHealth, redisHealth, queueHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkQueueHealth()
    ]);

    const totalLatency = Math.round(performance.now() - startTime);

    const isHealthy =
      dbHealth.status === 'ok' &&
      redisHealth.status === 'ok' &&
      queueHealth.status === 'ok';

    return {
      status: isHealthy ? ('healthy' as const) : ('degraded' as const),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error
        },
        redis: {
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error
        },
        queue: {
          status: queueHealth.status,
          pendingJobs: queueHealth.pendingJobs,
          failedJobs: queueHealth.failedJobs
        }
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      latencyMs: totalLatency
    };
  },
  {
    detail: {
      summary: 'Detailed health check (Admin)',
      description:
        'Returns detailed health metrics for all services. Requires admin authentication with 2FA enabled.',
      tags: ['Health', 'Admin'],
      security: [{ bearerAuth: [] }, { cookieAuth: [] }]
    },
    response: {
      200: t.Object(
        {
          status: t.Union([t.Literal('healthy'), t.Literal('degraded')]),
          timestamp: t.String({
            format: 'date-time',
            examples: ['2026-01-06T12:00:00Z']
          }),
          services: t.Object({
            database: t.Object({
              status: t.String({ examples: ['ok'] }),
              latencyMs: t.Optional(t.Number({ examples: [2] })),
              error: t.Optional(t.String({ examples: ['Connection refused'] }))
            }),
            redis: t.Object({
              status: t.String({ examples: ['ok'] }),
              latencyMs: t.Optional(t.Number({ examples: [1] })),
              error: t.Optional(t.String({ examples: ['Connection refused'] }))
            }),
            queue: t.Object({
              status: t.String({ examples: ['ok'] }),
              pendingJobs: t.Optional(t.Number({ examples: [15] })),
              failedJobs: t.Optional(t.Number({ examples: [0] }))
            })
          }),
          uptime: t.Number({ examples: [86400] }),
          memory: t.Object({
            used: t.Number({ examples: [128] }),
            total: t.Number({ examples: [256] }),
            rss: t.Number({ examples: [180] })
          }),
          latencyMs: t.Number({ examples: [5] })
        },
        {
          description: 'Detailed service health metrics',
          examples: [
            {
              status: 'healthy',
              timestamp: '2026-01-06T12:00:00Z',
              services: {
                database: { status: 'ok', latencyMs: 2 },
                redis: { status: 'ok', latencyMs: 1 },
                queue: { status: 'ok', pendingJobs: 15, failedJobs: 0 }
              },
              uptime: 86400,
              memory: { used: 128, total: 256, rss: 180 },
              latencyMs: 5
            }
          ]
        }
      ),
      401: t.Ref('response.error.401'),
      403: t.Ref('response.error.403')
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export const healthRoutes = new Elysia().use(healthSimple).use(healthDetailed);
