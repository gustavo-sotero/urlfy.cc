/**
 * Redis Streams shim - re-exports from @urlfy/cache.
 * Maintains backward compatibility for existing @/server/lib/redis-stream imports.
 */

export type { StreamMessage, StreamReadResult } from '@urlfy/cache';
export {
  CONSUMER_GROUPS,
  RedisStream,
  STREAM_NAMES
} from '@urlfy/cache';
