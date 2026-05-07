/**
 * Redis Streams shim - re-exports from @urlfy/cache.
 * Maintains backward compatibility for existing @/server/lib/redis-stream imports.
 */

export type { StreamMessage, StreamReadResult } from '@urlfy/cache';
export {
  CONSUMER_GROUPS,
  RedisStream,
  STREAM_NAMES,
  STREAM_RETENTION_MAXLEN
} from '@urlfy/cache';
