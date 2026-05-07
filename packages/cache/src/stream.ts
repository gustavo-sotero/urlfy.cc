/**
 * Redis Streams Wrapper for Bun Native Redis Client
 * Provides type-safe abstractions over raw XADD, XREADGROUP, XACK, etc.
 */

import { createLogger } from '@urlfy/telemetry';
import {
  canAttemptRedisCommand,
  getRedisClient,
  markRedisCommandFailure,
  markRedisCommandSuccess
} from './client';

const logger = createLogger('redis-stream');

// Lazy accessor — resolves the singleton at call time rather than at module
// import time, so that test overrides and closeRedis()+re-init do not leave
// this module holding a stale client reference.
function getRedis() {
  return getRedisClient();
}

function ensureRedisAvailable(command: string): void {
  if (!canAttemptRedisCommand()) {
    throw new Error(`Redis unavailable for ${command}`);
  }
}

/**
 * Parsed stream message structure
 */
export interface StreamMessage<T = Record<string, string>> {
  id: string;
  data: T;
}

/**
 * Stream read result
 */
export interface StreamReadResult<T = Record<string, string>> {
  stream: string;
  messages: StreamMessage<T>[];
}

/**
 * Redis Streams utility namespace
 * Abstracts raw Redis commands with type-safe methods
 *
 * Note: Uses namespace pattern instead of class to avoid linter warnings
 * about classes with only static members.
 */
export namespace RedisStream {
  /**
   * Add a message to a stream (XADD)
   * @param stream Stream name
   * @param payload Message payload (will be flattened to key-value pairs)
   * @param id Message ID (default: * for auto-generation)
   * @param maxLen When provided, appends `MAXLEN ~ maxLen` to the XADD command
   *               so the stream is trimmed to approximately that length. Uses
   *               the `~` (approximate) trimming strategy to avoid expensive
   *               O(n) full-trimming on every write.
   * @returns Generated message ID
   */
  export async function add(
    stream: string,
    payload: Record<string, unknown>,
    id = '*',
    maxLen?: number
  ): Promise<string> {
    ensureRedisAvailable('XADD');

    try {
      // Build XADD args: [stream, [MAXLEN ~ n,] id, key1, val1, ...]
      const args: string[] = [stream];

      if (maxLen !== undefined && maxLen > 0) {
        args.push('MAXLEN', '~', String(maxLen));
      }

      args.push(id);

      for (const [key, value] of Object.entries(payload)) {
        args.push(key);
        // Convert to string, handling various types
        args.push(
          typeof value === 'string'
            ? value
            : value === null || value === undefined
              ? ''
              : JSON.stringify(value)
        );
      }

      const messageId = await getRedis().send('XADD', args);
      markRedisCommandSuccess();

      return String(messageId);
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to add message to stream ${stream}`, {
        error: error instanceof Error ? error.message : String(error),
        stream,
        payload
      });
      throw error;
    }
  }

  /**
   * Create a consumer group (XGROUP CREATE)
   * @param stream Stream name
   * @param group Group name
   * @param startId Starting ID (default: $ for new messages only)
   * @param mkstream Create stream if it doesn't exist
   */
  export async function createGroup(
    stream: string,
    group: string,
    startId = '$',
    mkstream = true
  ): Promise<void> {
    ensureRedisAvailable('XGROUP');

    try {
      const args = ['CREATE', stream, group, startId];
      if (mkstream) {
        args.push('MKSTREAM');
      }

      await getRedis().send('XGROUP', args);
      markRedisCommandSuccess();
      logger.info(`[RedisStream] Consumer group created`, {
        stream,
        group,
        startId
      });
    } catch (error: unknown) {
      const err = error as Error & { message?: string };
      // Ignore BUSYGROUP error (group already exists)
      if (err.message?.includes('BUSYGROUP')) {
        markRedisCommandSuccess();
        logger.debug(
          `[RedisStream] Consumer group already exists: ${group} on ${stream}`
        );
        return;
      }

      markRedisCommandFailure(error);
      throw error;
    }
  }

  /**
   * Read messages from a stream using consumer group (XREADGROUP)
   * @param group Group name
   * @param consumer Consumer name
   * @param streams Array of stream names
   * @param count Max messages to read per stream
   * @param block Block for milliseconds (0 = forever, null = non-blocking)
   * @returns Array of stream read results
   */
  export async function readGroup<T = Record<string, string>>(
    group: string,
    consumer: string,
    streams: string[],
    count = 10,
    block: number | null = 5000
  ): Promise<StreamReadResult<T>[]> {
    ensureRedisAvailable('XREADGROUP');

    try {
      const args: string[] = ['GROUP', group, consumer, 'COUNT', String(count)];

      if (block !== null) {
        args.push('BLOCK', String(block));
      }

      args.push('STREAMS', ...streams);
      // Use '>' to read new messages not yet delivered to any consumer
      for (let i = 0; i < streams.length; i++) {
        args.push('>');
      }

      const response = await getRedis().send('XREADGROUP', args);
      markRedisCommandSuccess();

      if (!response) {
        return [];
      }

      // Parse RESP3 response: [[streamName, [[id, [key1, val1, key2, val2, ...]]]], ...]
      return parseStreamReadResponse<T>(response);
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to read from stream group`, {
        error: error instanceof Error ? error.message : String(error),
        group,
        consumer,
        streams
      });
      throw error;
    }
  }

  /**
   * Acknowledge processed messages (XACK)
   * @param stream Stream name
   * @param group Group name
   * @param ids Message IDs to acknowledge
   * @returns Number of messages acknowledged
   */
  export async function ack(
    stream: string,
    group: string,
    ids: string[]
  ): Promise<number> {
    if (ids.length === 0) return 0;

    ensureRedisAvailable('XACK');

    try {
      const result = await getRedis().send('XACK', [stream, group, ...ids]);
      markRedisCommandSuccess();
      return Number(result);
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to ack messages`, {
        error: error instanceof Error ? error.message : String(error),
        stream,
        group,
        idCount: ids.length
      });
      throw error;
    }
  }

  /**
   * Claim messages from dead consumers (XAUTOCLAIM)
   * Used for garbage collection of stuck messages
   * @param stream Stream name
   * @param group Group name
   * @param consumer New consumer name
   * @param minIdleTime Minimum idle time in milliseconds
   * @param start Starting ID (use '0-0' to start from beginning)
   * @param count Max messages to claim
   * @returns Claimed messages and next cursor
   */
  export async function autoClaim<T = Record<string, string>>(
    stream: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    start = '0-0',
    count = 10
  ): Promise<{ messages: StreamMessage<T>[]; cursor: string }> {
    ensureRedisAvailable('XAUTOCLAIM');

    try {
      const args = [stream, group, consumer, String(minIdleTime), start];
      if (count) {
        args.push('COUNT', String(count));
      }

      const response = await getRedis().send('XAUTOCLAIM', args);
      markRedisCommandSuccess();

      // Response format: [cursor, [[id, [key1, val1, ...]], ...], [deletedIds]]
      if (!Array.isArray(response) || response.length < 2) {
        return { messages: [], cursor: '0-0' };
      }

      const cursor = String(response[0]);
      const rawMessages = response[1];

      const messages: StreamMessage<T>[] = [];
      if (Array.isArray(rawMessages)) {
        for (const item of rawMessages) {
          if (Array.isArray(item) && item.length === 2) {
            messages.push({
              id: String(item[0]),
              data: parseFields<T>(item[1])
            });
          }
        }
      }

      return { messages, cursor };
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to autoclaim messages`, {
        error: error instanceof Error ? error.message : String(error),
        stream,
        group,
        consumer
      });
      throw error;
    }
  }

  /**
   * Get stream information (XINFO STREAM)
   * @param stream Stream name
   * @returns Stream info object
   */
  export async function info(stream: string): Promise<Record<string, unknown>> {
    ensureRedisAvailable('XINFO STREAM');

    try {
      const response = await getRedis().send('XINFO', ['STREAM', stream]);
      markRedisCommandSuccess();
      return parseInfoResponse(response);
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to get stream info`, {
        error: error instanceof Error ? error.message : String(error),
        stream
      });
      throw error;
    }
  }

  /**
   * Get consumer group information (XINFO GROUPS)
   * @param stream Stream name
   * @returns Array of group info objects
   */
  export async function groups(
    stream: string
  ): Promise<Record<string, unknown>[]> {
    ensureRedisAvailable('XINFO GROUPS');

    try {
      const response = await getRedis().send('XINFO', ['GROUPS', stream]);
      markRedisCommandSuccess();
      if (!Array.isArray(response)) return [];

      return response.map((group) => parseInfoResponse(group));
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to get group info`, {
        error: error instanceof Error ? error.message : String(error),
        stream
      });
      throw error;
    }
  }

  /**
   * Get stream length (XLEN)
   * @param stream Stream name
   * @returns Number of messages in stream
   */
  export async function getLength(stream: string): Promise<number> {
    ensureRedisAvailable('XLEN');

    try {
      const result = await getRedis().send('XLEN', [stream]);
      markRedisCommandSuccess();
      return Number(result);
    } catch (error) {
      markRedisCommandFailure(error);
      logger.error(`[RedisStream] Failed to get stream length`, {
        error: error instanceof Error ? error.message : String(error),
        stream
      });
      throw error;
    }
  }

  /**
   * Get pending message count for a group (XPENDING)
   * @param stream Stream name
   * @param group Group name
   * @returns Total number of pending messages
   */
  export async function getPendingCount(
    stream: string,
    group: string
  ): Promise<number> {
    if (!canAttemptRedisCommand()) {
      return 0;
    }

    try {
      // XPENDING stream group
      // Returns: [count, firstId, lastId, [[consumer, count], ...]]
      const response = await getRedis().send('XPENDING', [stream, group]);
      markRedisCommandSuccess();

      if (Array.isArray(response) && response.length > 0) {
        return Number(response[0]);
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Ignore when the stream/group does not exist yet.
      if (message.includes('NOGROUP') || message.includes('no such key')) {
        return 0;
      }

      markRedisCommandFailure(error);

      // Ignore here so callers can treat "no pending" uniformly.
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE PARSING HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Parse XREADGROUP response
   * Format: [[streamName, [[id, [key1, val1, key2, val2, ...]]]], ...]
   */
  function parseStreamReadResponse<T>(
    response: unknown
  ): StreamReadResult<T>[] {
    if (!Array.isArray(response)) return [];

    const results: StreamReadResult<T>[] = [];

    for (const streamData of response) {
      if (!Array.isArray(streamData) || streamData.length !== 2) continue;

      const streamName = String(streamData[0]);
      const messages = streamData[1];

      if (!Array.isArray(messages)) continue;

      const parsedMessages: StreamMessage<T>[] = [];

      for (const message of messages) {
        if (!Array.isArray(message) || message.length !== 2) continue;

        const id = String(message[0]);
        const fields = message[1];

        parsedMessages.push({
          id,
          data: parseFields<T>(fields)
        });
      }

      results.push({
        stream: streamName,
        messages: parsedMessages
      });
    }

    return results;
  }

  /**
   * Parse field array to object
   * Format: [key1, val1, key2, val2, ...]
   */
  function parseFields<T>(fields: unknown): T {
    if (!Array.isArray(fields)) {
      return {} as T;
    }

    const obj: Record<string, string> = {};

    for (let i = 0; i < fields.length; i += 2) {
      const key = String(fields[i]);
      const value = fields[i + 1];
      obj[key] = value === null ? '' : String(value);
    }

    return obj as T;
  }

  /**
   * Parse XINFO response (array of key-value pairs)
   * Format: [key1, val1, key2, val2, ...]
   */
  function parseInfoResponse(response: unknown): Record<string, unknown> {
    if (!Array.isArray(response)) return {};

    const obj: Record<string, unknown> = {};

    for (let i = 0; i < response.length; i += 2) {
      const key = String(response[i]);
      const value = response[i + 1];
      obj[key] = value;
    }

    return obj;
  }
}

/**
 * Stream names used in the application
 */
export const STREAM_NAMES = {
  analyticsClicks: 'analytics:clicks',
  analyticsDead: 'analytics:dead',
  aggregation: 'aggregation',
  aggregationDead: 'aggregation:dead',
  cleanup: 'cleanup',
  cleanupDead: 'cleanup:dead',
  deletion: 'deletion',
  deletionDead: 'deletion:dead',
  notifications: 'notifications'
} as const;

/**
 * Consumer group names
 */
export const CONSUMER_GROUPS = {
  analytics: 'analytics-group',
  analyticsDead: 'analytics-dead-group',
  aggregation: 'aggregation-group',
  cleanup: 'cleanup-group',
  deletion: 'deletion-group',
  notifications: 'notifications-group'
} as const;
