/**
 * Admin Queue Observability Endpoint
 * Provides introspection into Redis Streams state
 */

import { Elysia, t } from 'elysia';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import { SuccessResponse } from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth/require-admin';
import { AdminModel } from './admin.schema';

const logger = createLogger('admin:queues');

/**
 * Stream stats structure
 */
export interface StreamStats {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
  /** Indicates the data source was unavailable and values are stale/default. */
  degraded?: boolean;
}

type RedisStreamLike = Pick<
  typeof RedisStream,
  'getLength' | 'groups' | 'info'
>;

interface AdminQueuesControllerDeps {
  redisStream?: RedisStreamLike;
  streamNames?: Record<string, string>;
}

/**
 * Get stats for a single stream
 */
async function getStreamStats(
  stream: string,
  redisStream: RedisStreamLike
): Promise<StreamStats> {
  try {
    const [infoResult, groupsResult, lengthResult] = await Promise.allSettled([
      redisStream.info(stream),
      redisStream.groups(stream),
      redisStream.getLength(stream)
    ]);

    const degraded =
      infoResult.status === 'rejected' ||
      groupsResult.status === 'rejected' ||
      lengthResult.status === 'rejected';

    if (degraded) {
      logger.warn(`[getStreamStats] Redis dependency degraded for ${stream}`);
    }

    const info = infoResult.status === 'fulfilled' ? infoResult.value : {};
    const groups =
      groupsResult.status === 'fulfilled' ? groupsResult.value : [];
    const streamLength =
      lengthResult.status === 'fulfilled' ? lengthResult.value : 0;

    // Calculate total pending messages and consumers across all groups
    const totalPending = groups.reduce((acc, group) => {
      return acc + (Number(group.pending) || 0);
    }, 0);

    const totalConsumers = groups.reduce((acc, group) => {
      return acc + (Number(group.consumers) || 0);
    }, 0);

    return {
      name: stream,
      length: streamLength,
      groups: groups.length,
      consumers: totalConsumers,
      lastGeneratedId: (info as Record<string, unknown>)['last-generated-id']
        ? String((info as Record<string, unknown>)['last-generated-id'])
        : undefined,
      pending: totalPending,
      ...(degraded ? { degraded: true } : {})
    };
  } catch (error) {
    logger.error(`[getStreamStats] Failed to get stats for ${stream}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      name: stream,
      length: 0,
      groups: 0,
      pending: 0,
      degraded: true
    };
  }
}

/**
 * Admin Queues Controller
 */
export function createAdminQueuesController(
  deps: AdminQueuesControllerDeps = {}
) {
  const redisStream = deps.redisStream ?? RedisStream;
  const streamNames = Object.values(deps.streamNames ?? STREAM_NAMES);

  return new Elysia({ prefix: '/admin/queues' })
    .use(AdminModel)
    .use(requireAdmin)
    .use(adminRateLimits.general)
    .get(
      '/',
      async ({ user: _user }) => {
        const stats = await Promise.all(
          streamNames.map((stream) => getStreamStats(stream, redisStream))
        );

        const result: Record<string, StreamStats> = {};
        let anyDegraded = false;
        for (const stat of stats) {
          result[stat.name] = stat;
          if (stat.degraded) anyDegraded = true;
        }

        return {
          success: true,
          data: result,
          ...(anyDegraded ? { degraded: true } : {})
        };
      },
      {
        detail: {
          tags: ['Admin'],
          summary: 'Get queue statistics',
          description: 'Retrieve stats for all Redis Streams (admin only)'
        },
        response: {
          200: t.Object({
            success: t.Literal(true),
            data: t.Record(t.String(), t.Ref('admin.queue.stream.stats')),
            degraded: t.Optional(t.Boolean())
          }),
          401: t.Ref('response.error.401'),
          403: t.Ref('response.error.403'),
          500: t.Ref('response.error.500')
        }
      }
    )
    .get(
      '/:stream',
      async ({ params, user: _user }) => {
        const stats = await getStreamStats(params.stream, redisStream);

        return {
          success: true,
          data: stats
        };
      },
      {
        params: t.Object({
          stream: t.String()
        }),
        detail: {
          tags: ['Admin'],
          summary: 'Get stream statistics',
          description: 'Retrieve stats for a specific Redis Stream (admin only)'
        },
        response: {
          200: SuccessResponse(
            t.Ref('admin.queue.stream.stats'),
            'Statistics for a single Redis Stream'
          ),
          401: t.Ref('response.error.401'),
          403: t.Ref('response.error.403'),
          500: t.Ref('response.error.500')
        }
      }
    );
}

export const adminQueuesController = createAdminQueuesController();
