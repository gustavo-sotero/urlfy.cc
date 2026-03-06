import { checkRedisHealth } from '@urlfy/cache';
import { checkDatabaseHealth } from '@urlfy/data';

type DependencyHealth = Awaited<ReturnType<typeof checkDatabaseHealth>>;

interface WorkerHealthDependencies {
  checkDatabaseHealth: () => Promise<DependencyHealth>;
  checkRedisHealth: () => Promise<DependencyHealth>;
}

export interface WorkerHealthStatus {
  status: 'ok' | 'error';
  services: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

export async function getWorkerHealthStatus(
  dependencies: WorkerHealthDependencies = {
    checkDatabaseHealth,
    checkRedisHealth
  }
): Promise<WorkerHealthStatus> {
  const [database, redis] = await Promise.all([
    dependencies.checkDatabaseHealth(),
    dependencies.checkRedisHealth()
  ]);

  return {
    status: database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'error',
    services: {
      database,
      redis
    }
  };
}

async function main() {
  const health = await getWorkerHealthStatus();

  if (health.status === 'ok') {
    process.exit(0);
  }

  process.stderr.write(`${JSON.stringify(health)}\n`);
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      })}\n`
    );
    process.exit(1);
  });
}
