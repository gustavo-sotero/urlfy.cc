import { checkDatabaseHealth } from '@/db';
import { Elysia, t } from 'elysia';
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
        tags: ['Health']
      },
      response: {
        200: t.Object({
          status: t.Literal('ok'),
          timestamp: t.String({ format: 'date-time' })
        })
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
        tags: ['Health']
      },
      response: {
        200: t.Object({
          status: t.Union([t.Literal('ready'), t.Literal('not_ready')]),
          services: t.Object({
            database: t.String(),
            redis: t.String()
          })
        }),
        503: t.Object({
          status: t.Literal('not_ready'),
          services: t.Object({
            database: t.String(),
            redis: t.String()
          })
        })
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
      200: t.Object({
        status: t.Union([t.Literal('healthy'), t.Literal('degraded')]),
        timestamp: t.String({ format: 'date-time' }),
        services: t.Object({
          database: t.Object({
            status: t.String(),
            latencyMs: t.Optional(t.Number()),
            error: t.Optional(t.String())
          }),
          redis: t.Object({
            status: t.String(),
            latencyMs: t.Optional(t.Number()),
            error: t.Optional(t.String())
          }),
          queue: t.Object({
            status: t.String(),
            pendingJobs: t.Optional(t.Number()),
            failedJobs: t.Optional(t.Number())
          })
        }),
        uptime: t.Number(),
        memory: t.Object({
          used: t.Number(),
          total: t.Number(),
          rss: t.Number()
        }),
        latencyMs: t.Number()
      }),
      401: t.Ref('response.error.401'),
      403: t.Ref('response.error.403')
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export const healthRoutes = new Elysia().use(healthSimple).use(healthDetailed);
