import { describe, expect, test } from 'bun:test';
import { getWorkerHealthStatus } from '@/healthcheck';

describe('getWorkerHealthStatus', () => {
  test('returns ok when database and redis are healthy', async () => {
    const result = await getWorkerHealthStatus({
      checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 2 }),
      checkRedisHealth: async () => ({ status: 'ok', latencyMs: 1 })
    });

    expect(result).toEqual({
      status: 'ok',
      services: {
        database: { status: 'ok', latencyMs: 2 },
        redis: { status: 'ok', latencyMs: 1 }
      }
    });
  });

  test('returns error when a dependency is unhealthy', async () => {
    const result = await getWorkerHealthStatus({
      checkDatabaseHealth: async () => ({
        status: 'error',
        latencyMs: 9,
        error: 'connection refused'
      }),
      checkRedisHealth: async () => ({ status: 'ok', latencyMs: 1 })
    });

    expect(result.status).toBe('error');
    expect(result.services.database.error).toBe('connection refused');
    expect(result.services.redis.status).toBe('ok');
  });
});
