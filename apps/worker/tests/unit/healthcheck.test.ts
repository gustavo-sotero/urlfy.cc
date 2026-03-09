import { describe, expect, test } from 'bun:test';
import { getWorkerHealthStatus } from '../../src/healthcheck';

describe('Worker healthcheck', () => {
  test('returns ok when database and redis are healthy', async () => {
    const status = await getWorkerHealthStatus({
      checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 3 }),
      checkRedisHealth: async () => ({ status: 'ok', latencyMs: 2 })
    });

    expect(status.status).toBe('ok');
    expect(status.services.database.status).toBe('ok');
    expect(status.services.redis.status).toBe('ok');
  });

  test('returns error when database check fails', async () => {
    const status = await getWorkerHealthStatus({
      checkDatabaseHealth: async () => ({
        status: 'error',
        error: 'db unavailable'
      }),
      checkRedisHealth: async () => ({ status: 'ok', latencyMs: 2 })
    });

    expect(status.status).toBe('error');
    expect(status.services.database.status).toBe('error');
    expect(status.services.redis.status).toBe('ok');
  });

  test('returns error when redis check fails', async () => {
    const status = await getWorkerHealthStatus({
      checkDatabaseHealth: async () => ({ status: 'ok', latencyMs: 4 }),
      checkRedisHealth: async () => ({
        status: 'error',
        error: 'redis unavailable'
      })
    });

    expect(status.status).toBe('error');
    expect(status.services.database.status).toBe('ok');
    expect(status.services.redis.status).toBe('error');
  });
});
