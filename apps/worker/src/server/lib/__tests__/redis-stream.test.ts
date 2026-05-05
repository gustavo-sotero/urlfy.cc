import { afterAll, describe, expect, it, mock } from 'bun:test';

async function importFreshModule<T>(path: string): Promise<T> {
  return (await import(`${path}?worker-redis-stream-shim-test-module`)) as T;
}

const canonicalStreamModule = await importFreshModule<
  typeof import('@urlfy/cache')
>('../../../../../../packages/cache/src/index.ts');

// Worker test files hoist mock.module('@urlfy/cache', ...) registrations.
// Pin the shim to a fresh real module here so this contract test stays stable.
mock.module('@urlfy/cache', () => canonicalStreamModule);

const { CONSUMER_GROUPS, RedisStream, STREAM_NAMES } =
  await importFreshModule<typeof import('@/server/lib/redis-stream')>(
    '../redis-stream.ts'
  );

describe('worker redis-stream shim', () => {
  afterAll(() => {
    mock.restore();
  });

  it('re-exports the canonical stream names including dead-letter streams', () => {
    expect(STREAM_NAMES).toEqual(canonicalStreamModule.STREAM_NAMES);
  });

  it('re-exports the canonical consumer groups', () => {
    expect(CONSUMER_GROUPS).toEqual(canonicalStreamModule.CONSUMER_GROUPS);
  });

  it('re-exports the canonical RedisStream namespace shape', () => {
    expect(Object.keys(RedisStream).sort()).toEqual(
      Object.keys(canonicalStreamModule.RedisStream).sort()
    );
  });

  it('exposes the full RedisStream method surface used by workers', async () => {
    expect(typeof RedisStream.add).toBe('function');
    expect(typeof RedisStream.createGroup).toBe('function');
    expect(typeof RedisStream.readGroup).toBe('function');
    expect(typeof RedisStream.ack).toBe('function');
    expect(typeof RedisStream.getLength).toBe('function');
    expect(typeof RedisStream.info).toBe('function');
    expect(typeof RedisStream.groups).toBe('function');
    expect(typeof RedisStream.autoClaim).toBe('function');
    expect(typeof RedisStream.getPendingCount).toBe('function');
  });
});
