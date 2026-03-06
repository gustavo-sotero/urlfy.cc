// apps/api/tests/helpers/integration-helper.ts
// Helper utilities for integration tests

import { testLogger } from './test-logger';

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
  try {
    const { checkDatabaseHealth } = await import('@urlfy/data');
    const health = await checkDatabaseHealth();
    return health.status === 'ok';
  } catch {
    return false;
  }
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
  const dbUp = await isDatabaseAvailable();
  if (!dbUp) {
    throw new Error(
      'Test skipped: Database not available. Start with `docker-compose up -d postgres`'
    );
  }
}

export { testLogger };
