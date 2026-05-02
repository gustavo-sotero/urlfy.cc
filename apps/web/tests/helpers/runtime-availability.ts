const DEFAULT_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

export interface RuntimeAvailability {
  available: boolean;
  reason?: string;
}

export interface ServerAvailability extends RuntimeAvailability {
  baseUrl: string;
}

export async function detectRedirectInfrastructure(): Promise<RuntimeAvailability> {
  try {
    const { checkDatabaseHealth } = await import('@urlfy/data');
    const databaseHealth = await checkDatabaseHealth();

    if (databaseHealth.status !== 'ok') {
      return {
        available: false,
        reason: `Database connection failed: ${databaseHealth.error || 'Unknown error'}`
      };
    }

    if (process.env.USE_REAL_REDIS !== 'true') {
      return {
        available: false,
        reason: 'Redis not enabled for integration tests'
      };
    }

    const { checkRedisHealth } = await import('@urlfy/cache');
    const redisHealth = await checkRedisHealth();

    if (redisHealth.status !== 'ok') {
      return {
        available: false,
        reason: `Redis connection failed: ${redisHealth.error || 'Unknown error'}`
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

export async function detectUrlfyServer(
  baseUrl = DEFAULT_BASE_URL
): Promise<ServerAvailability> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });

    if (!response.ok) {
      return {
        baseUrl,
        available: false,
        reason: `Health endpoint returned ${response.status}`
      };
    }

    const requestId = response.headers.get('x-request-id');
    const contentType = response.headers.get('content-type') || '';

    if (!requestId || !contentType.includes('application/json')) {
      return {
        baseUrl,
        available: false,
        reason: 'Server did not expose the expected urlfy.cc health response'
      };
    }

    const body = await response.json().catch(() => null);

    if (body?.status !== 'ok') {
      return {
        baseUrl,
        available: false,
        reason: 'Server is not urlfy.cc'
      };
    }

    return { baseUrl, available: true };
  } catch (error) {
    return {
      baseUrl,
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
