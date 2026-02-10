/**
 * Database Health Check Script
 *
 * Tests PostgreSQL connectivity using Bun's native SQL driver.
 * Used by docker-entrypoint.sh to wait for the database before
 * running migrations.
 *
 * If the DATABASE_URL doesn't include ?sslmode=, defaults to
 * ssl: "prefer" so managed PostgreSQL instances (that require TLS)
 * work out of the box while plain local databases still connect.
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

// Mask credentials for safe logging
function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid url)';
  }
}

// If the URL already contains sslmode, use it as-is.
// Otherwise append sslmode=prefer (try TLS first, fallback to plain).
const urlHasSSL = url.includes('sslmode=');
const connUrl = urlHasSSL
  ? url
  : `${url}${url.includes('?') ? '&' : '?'}sslmode=prefer`;

try {
  const sql = new SQL({
    url: connUrl,
    connectionTimeout: 5,
    max: 1
  });
  await sql.unsafe('SELECT 1');
  await sql.close();
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[db-check] ${message}`);
  console.error(`[db-check] URL: ${safeUrl(url)}`);
  console.error(
    `[db-check] SSL: ${urlHasSSL ? '(from URL)' : 'prefer (auto)'}`
  );
  process.exit(1);
}
