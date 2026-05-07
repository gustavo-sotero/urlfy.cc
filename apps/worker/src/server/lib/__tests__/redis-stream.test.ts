import { describe, expect, it } from 'bun:test';

const { readFile } = await import('node:fs/promises');
const redisStreamShimSource = await readFile(
  new URL('../redis-stream.ts', import.meta.url),
  'utf8'
);
const cacheIndexSource = await readFile(
  new URL('../../../../../../packages/cache/src/index.ts', import.meta.url),
  'utf8'
);
const cacheStreamSource = await readFile(
  new URL('../../../../../../packages/cache/src/stream.ts', import.meta.url),
  'utf8'
);

describe('worker redis-stream shim', () => {
  it('exposes the canonical worker stream names including dead-letter streams', () => {
    expect(cacheStreamSource).toContain("analyticsClicks: 'analytics:clicks'");
    expect(cacheStreamSource).toContain("analyticsDead: 'analytics:dead'");
    expect(cacheStreamSource).toContain("aggregation: 'aggregation'");
    expect(cacheStreamSource).toContain("aggregationDead: 'aggregation:dead'");
    expect(cacheStreamSource).toContain("cleanup: 'cleanup'");
    expect(cacheStreamSource).toContain("cleanupDead: 'cleanup:dead'");
    expect(cacheStreamSource).toContain("deletion: 'deletion'");
    expect(cacheStreamSource).toContain("deletionDead: 'deletion:dead'");
    expect(cacheStreamSource).toContain("notifications: 'notifications'");
  });

  it('exposes the canonical worker consumer groups', () => {
    expect(cacheStreamSource).toContain("analytics: 'analytics-group'");
    expect(cacheStreamSource).toContain(
      "analyticsDead: 'analytics-dead-group'"
    );
    expect(cacheStreamSource).toContain("aggregation: 'aggregation-group'");
    expect(cacheStreamSource).toContain("cleanup: 'cleanup-group'");
    expect(cacheStreamSource).toContain("deletion: 'deletion-group'");
    expect(cacheStreamSource).toContain("notifications: 'notifications-group'");
  });

  it('exposes the expected RedisStream namespace shape for worker consumers', () => {
    expect(redisStreamShimSource).toContain(
      "export type { StreamMessage, StreamReadResult } from '@urlfy/cache';"
    );
    expect(redisStreamShimSource).toContain('CONSUMER_GROUPS');
    expect(redisStreamShimSource).toContain('RedisStream');
    expect(redisStreamShimSource).toContain('STREAM_NAMES');
    expect(redisStreamShimSource).toContain('STREAM_RETENTION_MAXLEN');
    expect(cacheIndexSource).toContain(
      "export type { StreamMessage, StreamReadResult } from './stream';"
    );
    expect(cacheIndexSource).toContain('CONSUMER_GROUPS');
    expect(cacheIndexSource).toContain('RedisStream');
    expect(cacheIndexSource).toContain('STREAM_NAMES');
    expect(cacheIndexSource).toContain('STREAM_RETENTION_MAXLEN');
  });

  it('exposes the full RedisStream method surface used by workers', async () => {
    expect(cacheStreamSource).toContain('export async function add(');
    expect(cacheStreamSource).toContain('export async function createGroup(');
    expect(cacheStreamSource).toContain('export async function readGroup<');
    expect(cacheStreamSource).toContain('export async function ack(');
    expect(cacheStreamSource).toContain('export async function getLength(');
    expect(cacheStreamSource).toContain('export async function info(');
    expect(cacheStreamSource).toContain('export async function groups(');
    expect(cacheStreamSource).toContain('export async function autoClaim<');
    expect(cacheStreamSource).toContain(
      'export async function getPendingCount('
    );
  });
});
