/**
 * ═════════════════════════════════════════════════════════════════════
 * HEALTH CONTROLLER - Health check endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Internal
 * Pattern: Elysia Controller
 * Migrated from: src/server/api/health.ts
 * ═════════════════════════════════════════════════════════════════════
 */

import { checkDatabaseHealth } from '@urlfy/data';
import { Elysia, t } from 'elysia';
import { getOpenAPIDegradedState } from '@/server/lib/openapi-merger';
import { checkRedisHealth } from '@/server/lib/redis';
import { ResponseModels } from '@/server/lib/response.schema';
import { requireAdmin } from '@/server/middleware/auth';
import { reloadBannedDomains } from '../links/services/url-validator';

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK SIMPLES (público)
// ═══════════════════════════════════════════════════════════════════
const healthSimple = new Elysia()
  .use(ResponseModels)
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

      const isDatabaseReady = dbHealth.status === 'ok';
      const isRedisDegraded = redisHealth.status !== 'ok';

      if (!isDatabaseReady) {
        set.status = 503;
      }

      return {
        status: isDatabaseReady ? ('ready' as const) : ('not_ready' as const),
        degraded: isRedisDegraded,
        services: {
          database: dbHealth.status,
          redis: redisHealth.status
        }
      };
    },
    {
      detail: {
        summary: 'Readiness check',
        description:
          'Checks whether the API can serve traffic. Database is required; Redis degradation is reported without blocking readiness.',
        tags: ['Health'],
        security: [] // Public endpoint - no authentication required
      },
      response: {
        200: t.Object(
          {
            status: t.Literal('ready'),
            degraded: t.Boolean({
              description:
                'True when optional Redis-backed features are degraded but the API can still serve traffic',
              examples: [false]
            }),
            services: t.Object({
              database: t.String({ examples: ['ok'] }),
              redis: t.String({ examples: ['ok'] })
            })
          },
          {
            description:
              'Database is ready; Redis status is reported separately',
            examples: [
              {
                status: 'ready',
                degraded: false,
                services: { database: 'ok', redis: 'ok' }
              },
              {
                status: 'ready',
                degraded: true,
                services: { database: 'ok', redis: 'error' }
              }
            ]
          }
        ),
        503: t.Object(
          {
            status: t.Literal('not_ready'),
            degraded: t.Boolean({ examples: [false] }),
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

const healthDetailed = new Elysia()
  .use(requireAdmin)
  .use(ResponseModels)
  .get(
    '/health/detailed',
    async () => {
      const startTime = performance.now();

      const [dbHealth, redisHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth()
      ]);

      const totalLatency = Math.round(performance.now() - startTime);

      const isHealthy = dbHealth.status === 'ok' && redisHealth.status === 'ok';
      const docsDegraded = getOpenAPIDegradedState();

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
          }
        },
        docs: {
          degraded: docsDegraded
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
          'Returns detailed health metrics for all services. Requires authenticated admin access derived from the linked GitHub account allowlist.',
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
                error: t.Optional(
                  t.String({ examples: ['Connection refused'] })
                )
              }),
              redis: t.Object({
                status: t.String({ examples: ['ok'] }),
                latencyMs: t.Optional(t.Number({ examples: [1] })),
                error: t.Optional(
                  t.String({ examples: ['Connection refused'] })
                )
              })
            }),
            docs: t.Object({
              degraded: t.Boolean({
                description:
                  'True if Better-Auth OpenAPI schema generation failed and a minimal stub is served instead',
                examples: [false]
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
                  redis: { status: 'ok', latencyMs: 1 }
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
  )
  .post(
    '/health/banned-domains/reload',
    async ({ set }) => {
      const result = await reloadBannedDomains();
      const snapshot = result.snapshot;

      if (!result.reloaded) {
        set.status = 503;

        return {
          status: result.retainedSnapshot
            ? ('retained_snapshot' as const)
            : ('unavailable' as const),
          error: result.error,
          snapshot: {
            ...snapshot,
            hasReliableSnapshot: snapshot.hasReliableSnapshot
          }
        };
      }

      return {
        status: 'reloaded' as const,
        snapshot: {
          ...snapshot,
          hasReliableSnapshot: true as const
        }
      };
    },
    {
      detail: {
        summary: 'Reload banned-domain snapshot (Admin)',
        description:
          'Forces an immediate refresh of the in-memory banned-domain snapshot used by URL validation. Requires authenticated admin access.',
        tags: ['Health', 'Admin'],
        security: [{ bearerAuth: [] }, { cookieAuth: [] }]
      },
      response: {
        200: t.Object({
          status: t.Literal('reloaded'),
          snapshot: t.Object({
            loaded: t.Boolean({ examples: [true] }),
            hasReliableSnapshot: t.Literal(true),
            domainCount: t.Number({ examples: [3] }),
            lastLoadedAt: t.Union([
              t.String({ format: 'date-time' }),
              t.Null()
            ]),
            cacheAgeMs: t.Union([t.Number({ examples: [0] }), t.Null()])
          })
        }),
        503: t.Object({
          status: t.Union([
            t.Literal('unavailable'),
            t.Literal('retained_snapshot')
          ]),
          error: t.Union([t.String(), t.Null()]),
          snapshot: t.Object({
            loaded: t.Boolean({ examples: [false] }),
            hasReliableSnapshot: t.Boolean({ examples: [false] }),
            domainCount: t.Number({ examples: [0] }),
            lastLoadedAt: t.Union([
              t.String({ format: 'date-time' }),
              t.Null()
            ]),
            cacheAgeMs: t.Union([t.Number({ examples: [0] }), t.Null()])
          })
        }),
        401: t.Ref('response.error.401'),
        403: t.Ref('response.error.403')
      }
    }
  );

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export const healthController = new Elysia()
  .use(healthSimple)
  .use(healthDetailed);
