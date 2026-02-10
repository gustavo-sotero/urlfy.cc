/**
 * Database Health Check Script
 *
 * Tests PostgreSQL connectivity using Bun's native SQL driver.
 * Used by docker-entrypoint.sh to wait for the database before
 * running migrations.
 *
 * Exit codes:
 *   0 - Database is reachable
 *   1 - Connection failed
 */

import { SQL } from 'bun';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('[db-check] DATABASE_URL is not set');
  process.exit(1);
}

try {
  const sql = new SQL({ url, connectionTimeout: 5 });
  await sql.unsafe('SELECT 1');
  await sql.close();
  process.exit(0);
} catch (err) {
  // Print the error so entrypoint can show it on last retry
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[db-check] ${message}`);
  process.exit(1);
}
