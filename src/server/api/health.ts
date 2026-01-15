import { Elysia } from 'elysia';
import { checkDatabaseHealth } from '@/db';
import { checkQueueHealth } from '../lib/queue';
import { checkRedisHealth } from '../lib/redis';
import { requireAdmin } from '../middleware/auth.middleware';

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK SIMPLES (público)
// ═══════════════════════════════════════════════════════════════════

const healthSimple = new Elysia().get(
  '/health',
  async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  },
  {
    detail: {
      summary: 'Simple health check',
      description: 'Returns basic health status',
      tags: ['Health']
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// READINESS CHECK (público)
// ═══════════════════════════════════════════════════════════════════

const healthReady = new Elysia().get(
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
      status: isReady ? 'ready' : 'not_ready',
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
      status: isHealthy ? 'healthy' : 'degraded',
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
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export const healthRoutes = new Elysia({ prefix: '/api/v1' })
  .use(healthSimple)
  .use(healthReady)
  .use(healthDetailed);
