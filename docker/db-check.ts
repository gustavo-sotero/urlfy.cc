/**
 * Database Health Check Script
 *
 * Tests PostgreSQL connectivity using Bun's native SQL driver.
 * Used by docker-entrypoint.sh to wait for the database before
 * running migrations.
 *
 * If the DATABASE_URL doesn't include ?sslmode=, defaults to
 * sslmode=disable (Bun SQL's "prefer" hangs on non-TLS servers).
 * For TLS, set ?sslmode=require in DATABASE_URL.
 *
 * Exit codes:
 *   0 - Database is reachable
 *   1 - Connection failed
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
const timeoutSecondsRaw = process.env.DB_CHECK_TIMEOUT;
const timeoutSeconds = timeoutSecondsRaw
  ? Number.parseInt(timeoutSecondsRaw, 10)
  : 5;
const timeoutSecondsClamped =
  Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : 5;
const timeoutMs = timeoutSecondsClamped * 1000;

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
// Otherwise default to sslmode=disable.
//
// Bun SQL's sslmode=prefer hangs for the full connectionTimeout when
// PostgreSQL doesn't support TLS (common in Docker-to-Docker setups).
// If the database requires TLS, set sslmode=require in DATABASE_URL.
const urlHasSSL = url.includes('sslmode=');
const connUrl = urlHasSSL
  ? url
  : `${url}${url.includes('?') ? '&' : '?'}sslmode=disable`;

function parseHostPort(raw: string): { host: string; port: number } | null {
  try {
    const u = new URL(raw);
    const port = u.port ? Number(u.port) : 5432;
    if (!u.hostname) return null;
    if (!Number.isFinite(port) || port <= 0) return null;
    return { host: u.hostname, port };
  } catch {
    return null;
  }
}

async function tcpProbe(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const timer = setTimeout(() => {
      socket.destroy(
        new Error(`TCP probe timeout after ${timeoutSecondsClamped}s`)
      );
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

try {
  const hostPort = parseHostPort(connUrl);
  if (hostPort) {
    try {
      const lookup = await dns.lookup(hostPort.host);
      console.error(
        `[db-check] DNS: ${hostPort.host} -> ${lookup.address} (${lookup.family === 6 ? 'IPv6' : 'IPv4'})`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[db-check] DNS lookup failed for host: ${hostPort.host}`);
      console.error(`[db-check] DNS error: ${message}`);
    }

    try {
      await tcpProbe(hostPort.host, hostPort.port);
      console.error(
        `[db-check] TCP: ${hostPort.host}:${hostPort.port} reachable`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `TCP probe failed for ${hostPort.host}:${hostPort.port}: ${message}`
      );
    }
  }

  const connectOnce = async (connectionUrl: string) => {
    const sql = new SQL({
      url: connectionUrl,
      connectionTimeout: timeoutSecondsClamped,
      max: 1
    });
    try {
      await sql.unsafe('SELECT 1');
    } finally {
      await sql.close();
    }
  };

  await connectOnce(connUrl);

  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[db-check] ${message}`);
  console.error(`[db-check] URL: ${safeUrl(url)}`);
  console.error(
    `[db-check] SSL: ${urlHasSSL ? '(from URL)' : 'disable (auto)'}`
  );
  process.exit(1);
}
