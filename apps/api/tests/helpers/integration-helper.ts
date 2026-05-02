// apps/api/tests/helpers/integration-helper.ts
// Helper utilities for integration tests

import { testLogger } from './test-logger';

export interface IntegrationAvailability {
  available: boolean;
  reason?: string;
}

async function probeDatabaseConnection(): Promise<IntegrationAvailability> {
  try {
    const databaseUrl =
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/urlfy';
    const { SQL } = await import('bun');
    const sql = new SQL({ url: databaseUrl, connectionTimeout: 3 });
    const result = await sql`SELECT 1 as test`;
    sql.close();

    if (!result || result.length === 0) {
      return {
        available: false,
        reason: 'Database query returned no result'
      };
    }

    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function probeRedisConnection(): Promise<IntegrationAvailability> {
  try {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const redis = new Bun.RedisClient(redisUrl);
    const pong = await redis.send('PING', []);
    redis.close();

    if (pong !== 'PONG') {
      return {
        available: false,
        reason: 'Redis PING failed'
      };
    }

    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if the development server is running at localhost:3000
 * @returns Promise<boolean> true if server is available
 */
export async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if the database is available
 * @returns Promise<boolean> true if database is connected
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  const status = await detectDatabaseAvailability();
  return status.available;
}

export async function detectDatabaseAvailability(): Promise<IntegrationAvailability> {
  return probeDatabaseConnection();
}

export async function detectDatabaseAndRedisAvailability(): Promise<IntegrationAvailability> {
  const databaseStatus = await probeDatabaseConnection();
  if (!databaseStatus.available) {
    return {
      available: false,
      reason: `Database connection failed: ${databaseStatus.reason || 'Unknown error'}`
    };
  }

  const redisStatus = await probeRedisConnection();
  if (!redisStatus.available) {
    return {
      available: false,
      reason: `Redis connection failed: ${redisStatus.reason || 'Unknown error'}`
    };
  }

  return { available: true };
}

/**
 * Skip test if server is not running
 * Use at the start of integration test describe blocks
 */
export async function requireServer(): Promise<void> {
  const serverUp = await isServerRunning();
  if (!serverUp) {
    throw new Error(
      'Integration test skipped: Server not running at localhost:3000. Start with `bun dev`'
    );
  }
}

/**
 * Skip test if database is not available
 * Use at the start of database-dependent test describe blocks
 */
export async function requireDatabase(): Promise<void> {
  const databaseStatus = await detectDatabaseAvailability();
  if (!databaseStatus.available) {
    throw new Error(
      `Test skipped: Database not available. ${databaseStatus.reason || 'Start with `docker-compose up -d postgres`'}`
    );
  }
}

export { testLogger };
