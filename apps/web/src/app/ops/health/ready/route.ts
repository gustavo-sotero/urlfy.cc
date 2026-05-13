import { checkDatabaseHealth } from '@urlfy/data';
import { createLogger } from '@urlfy/telemetry';
import { resolveInternalApiOrigin } from '@/lib/api/internal-url';
import { checkRedisHealth } from '@/server/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('health:ready');

const API_HEALTH_TIMEOUT_MS = 3_000;

async function checkApiHealth(): Promise<{
  status: 'ok' | 'error';
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${resolveInternalApiOrigin()}/api/health/ready`,
      {
        cache: 'no-store',
        signal: controller.signal
      }
    );

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

  // Log internal dependency details server-side for observability;
  // do NOT include them in the response body — callers (load balancers,
  // uptime monitors, public clients) must not see raw error messages or
  // internal topology information.
  if (!isReady || isDegraded) {
    logger.warn('[health/ready] degraded or not ready', {
      api: apiHealth,
      redis: redisHealth,
      database: dbHealth
    });
  }

  const overallStatus = !isReady
    ? 'not_ready'
    : isDegraded
      ? 'degraded'
      : 'ready';

  return Response.json(
    {
      status: overallStatus,
      component: 'web',
      timestamp: new Date().toISOString()
    },
    {
      status: isReady ? 200 : 503
    }
  );
}
