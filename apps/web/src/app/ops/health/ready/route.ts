import { checkRedisHealth } from '@urlfy/cache';
import { checkDatabaseHealth } from '@urlfy/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_HEALTH_TIMEOUT_MS = 3_000;

function getApiInternalUrl(): string {
  return process.env.API_INTERNAL_URL || 'http://localhost:3001';
}

async function checkApiHealth(): Promise<{
  status: 'ok' | 'error';
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiInternalUrl()}/api/health/ready`, {
      cache: 'no-store',
      signal: controller.signal
    });

    return response.ok
      ? { status: 'ok' }
      : { status: 'error', error: `upstream returned ${response.status}` };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown API health error'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(): Promise<Response> {
  const [apiHealth, redisHealth, dbHealth] = await Promise.all([
    checkApiHealth(),
    checkRedisHealth(),
    checkDatabaseHealth()
  ]);

  const isReady = apiHealth.status === 'ok' && dbHealth.status === 'ok';
  const isDegraded = redisHealth.status !== 'ok';

  return Response.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      degraded: isDegraded,
      component: 'web',
      timestamp: new Date().toISOString(),
      services: {
        api: apiHealth,
        redis: redisHealth,
        database: dbHealth
      }
    },
    {
      status: isReady ? 200 : 503
    }
  );
}