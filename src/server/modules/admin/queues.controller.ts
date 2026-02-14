/**
 * Admin Queue Observability Endpoint
 * Provides introspection into Redis Streams state
 */

import { Elysia, t } from 'elysia';
import { RedisStream, STREAM_NAMES } from '@/server/lib/redis-stream';
import { createLogger } from '@/server/lib/telemetry';
import { requireAdmin } from '@/server/middleware/auth/require-admin';

const logger = createLogger('admin:queues');

/**
 * Stream stats structure
 */
interface StreamStats {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
}

/**
 * Get stats for a single stream
 */
async function getStreamStats(stream: string): Promise<StreamStats> {
  try {
    const [info, groups, streamLength] = await Promise.all([
      RedisStream.info(stream).catch(() => ({})),
      RedisStream.groups(stream).catch(() => []),
      RedisStream.getLength(stream).catch(() => 0)
    ]);

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
      pending: totalPending
    };
  } catch (error) {
    logger.error(`[getStreamStats] Failed to get stats for ${stream}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      name: stream,
      length: 0,
      groups: 0,
      pending: 0
    };
  }
}

/**
 * Admin Queues Controller
 */
export const adminQueuesController = new Elysia({ prefix: '/admin/queues' })
  .use(requireAdmin)
  .get(
    '/',
    async ({ user }) => {
      try {
        // Get stats for all streams in parallel
        const streamNames = Object.values(STREAM_NAMES);
        const stats = await Promise.all(
          streamNames.map((stream) => getStreamStats(stream))
        );

        // Build response object
        const result: Record<string, StreamStats> = {};
        for (const stat of stats) {
          result[stat.name] = stat;
        }

        return {
          success: true,
          data: result
        };
      } catch (error) {
        logger.error('[AdminQueuesController] Failed to get queue stats', {
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve queue stats'
          }
        };
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get queue statistics',
        description: 'Retrieve stats for all Redis Streams (admin only)'
      }
    }
  )
  .get(
    '/:stream',
    async ({ params, user }) => {
      try {
        const stats = await getStreamStats(params.stream);

        return {
          success: true,
          data: stats
        };
      } catch (error) {
        logger.error(
          `[AdminQueuesController] Failed to get stats for stream ${params.stream}`,
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve stream stats'
          }
        };
      }
    },
    {
      params: t.Object({
        stream: t.String()
      }),
      detail: {
        tags: ['Admin'],
        summary: 'Get stream statistics',
        description: 'Retrieve stats for a specific Redis Stream (admin only)'
      }
    }
  );
