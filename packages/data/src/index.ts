// Native Bun SQL for PostgreSQL

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { getLogger as getDrizzleLogger } from '@logtape/drizzle-orm';
import { SQL } from 'bun';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from './schema';

type DatabaseTargetInfo = {
  host: string | null;
  port: number | null;
  database: string | null;
};

type HostResolutionDiagnostics = {
  status: 'resolved' | 'failed' | 'skipped';
  addresses?: string[];
  error?: string;
};

const NETWORK_ERROR_FRAGMENTS = [
  'failedtoopensocket',
  'enotfound',
  'eai_again',
  'connection refused',
  'connection closed'
] as const;

// Type for the drizzle instance
type DrizzleDatabase = ReturnType<typeof drizzle>;

// Connection singleton
let dbInstance: DrizzleDatabase | null = null;
let sqlConnection: SQL | null = null;
let connectionError: Error | null = null;
const hostResolutionCache = new Map<
  string,
  Promise<HostResolutionDiagnostics>
>();

// Connection configuration (computed lazily on first getDatabase() call)
let connectionConfig: {
  connUrl: string;
  urlHasSSL: boolean;
  max: number;
  idleTimeout: number;
  connectionTimeout: number;
  target: DatabaseTargetInfo;
} | null = null;

function parseDatabaseTarget(databaseUrl: string): DatabaseTargetInfo {
  try {
    const parsedUrl = new URL(databaseUrl);
    const port = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : 5432;
    const database = parsedUrl.pathname.replace(/^\/+/, '') || null;

    return {
      host: parsedUrl.hostname || null,
      port: Number.isNaN(port) ? null : port,
      database
    };
  } catch {
    return {
      host: null,
      port: null,
      database: null
    };
  }
}

function getConnectionHint(
  host: string | null,
  message: string,
  hostResolution?: HostResolutionDiagnostics
): string | undefined {
  if (!isLikelyNetworkError(message)) {
    return;
  }

  if (hostResolution?.status === 'failed') {
    return `DNS lookup failed for DATABASE_URL host "${host ?? 'unknown'}": ${hostResolution.error}. Verify the hostname and ensure PostgreSQL is attached to the same Docker/Dokploy network.`;
  }

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return 'DATABASE_URL points at localhost. Inside Docker this resolves to the current container, not the PostgreSQL service.';
  }

  if (host === 'postgresql') {
    return 'This repo\'s bundled Compose files use "postgres" as the default service hostname. If you are on Dokploy, ensure "postgresql" is a real network alias or update DATABASE_URL to the reachable PostgreSQL host.';
  }

  return `Verify that DATABASE_URL host "${host ?? 'unknown'}" resolves from this runtime and that PostgreSQL is attached to the same Docker/Dokploy network.`;
}

function isLikelyNetworkError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return NETWORK_ERROR_FRAGMENTS.some((fragment) =>
    normalizedMessage.includes(fragment)
  );
}

function shouldDiagnoseHostResolution(
  host: string | null,
  message: string
): host is string {
  if (!host) {
    return false;
  }

  return isLikelyNetworkError(message);
}

async function diagnoseHostResolution(
  host: string
): Promise<HostResolutionDiagnostics> {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return { status: 'skipped' };
  }

  if (isIP(host)) {
    return { status: 'skipped' };
  }

  const cached = hostResolutionCache.get(host);
  if (cached) {
    return cached;
  }

  const lookupPromise = (async (): Promise<HostResolutionDiagnostics> => {
    try {
      const results = await lookup(host, { all: true });
      const addresses = [...new Set(results.map((result) => result.address))];

      return {
        status: 'resolved',
        addresses
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  const diagnostics = await lookupPromise;
  if (diagnostics.status === 'resolved') {
    hostResolutionCache.set(host, Promise.resolve(diagnostics));
  }

  return diagnostics;
}

function writeBootstrapLog(
  level: 'info' | 'error',
  message: string,
  context?: Record<string, unknown>
): void {
  const line = JSON.stringify({
    level,
    logger: 'db-bootstrap',
    message,
    timestamp: new Date().toISOString(),
    ...context
  });

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

function getConnectionConfig() {
  if (connectionConfig) return connectionConfig;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // If the user already specified sslmode in DATABASE_URL, respect it.
  // Otherwise default to sslmode=disable.
  //
  // Why NOT sslmode=prefer (Bun SQL default)?
  // Bun SQL's "prefer" does NOT gracefully fall back when the PostgreSQL
  // server doesn't support TLS. Instead it hangs for the entire
  // connectionTimeout (10s+) before throwing ERR_POSTGRES_CONNECTION_TIMEOUT.
  // This breaks Docker-to-Docker connections where PostgreSQL runs without SSL.
  //
  // If your PostgreSQL requires TLS, add ?sslmode=require to DATABASE_URL.
  const urlHasSSL = databaseUrl.includes('sslmode=');
  const connUrl = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=disable`;

  const max = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
  const idleTimeout = Number.parseInt(
    process.env.DB_POOL_IDLE_TIMEOUT || '30',
    10
  );
  const connectionTimeout = Number.parseInt(
    process.env.DB_POOL_CONNECTION_TIMEOUT ??
      process.env.DB_CHECK_TIMEOUT ??
      '10',
    10
  );
  const target = parseDatabaseTarget(databaseUrl);

  connectionConfig = {
    connUrl,
    urlHasSSL,
    max,
    idleTimeout,
    connectionTimeout,
    target
  };
  return connectionConfig;
}

export function getDatabaseBootstrapDiagnostics() {
  const { connectionTimeout, target, urlHasSSL } = getConnectionConfig();
  return {
    host: target.host,
    port: target.port,
    database: target.database,
    connectionTimeout,
    urlHasSSL
  };
}

function createSqlConnection(url: string): SQL {
  const { max, idleTimeout, connectionTimeout } = getConnectionConfig();
  return new SQL({ url, max, idleTimeout, connectionTimeout });
}

export function getDatabase(): DrizzleDatabase {
  if (connectionError) {
    throw connectionError;
  }

  if (dbInstance) return dbInstance;

  try {
    const { connUrl } = getConnectionConfig();
    sqlConnection = createSqlConnection(connUrl);
    dbInstance = drizzle(sqlConnection, {
      schema,
      logger: getDrizzleLogger({
        category: ['urlfy', 'db'],
        level: 'debug'
      })
    });
    // NOTE: Connection is lazy — no actual TCP/TLS happens here.
    // Call initDatabase() to eagerly test connectivity.
    return dbInstance;
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error
        : new Error('Failed to create database instance');
    writeBootstrapLog('error', 'Failed to create database instance', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw connectionError;
  }
}

/**
 * Eagerly tests database connectivity.
 *
 * Bun SQL connections are lazy — `new SQL(...)` never opens a socket.
 * This function forces an actual connection by running `SELECT 1`.
 *
 * Must be called during server startup (before serving requests).
 */
export async function initDatabase(): Promise<void> {
  // Ensure lazy instances are created
  getDatabase();

  if (!sqlConnection) {
    throw new Error('SQL connection not initialized after getDatabase()');
  }

  try {
    // Force actual connection — Bun SQL is lazy, so this is where the
    // first TCP/TLS handshake happens.
    await sqlConnection.unsafe('SELECT 1');
    const diagnostics = getDatabaseBootstrapDiagnostics();
    writeBootstrapLog('info', 'Database connection established (Bun SQL)', {
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      connectionTimeout: diagnostics.connectionTimeout
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    connectionError = err instanceof Error ? err : new Error(message);
    const diagnostics = getDatabaseBootstrapDiagnostics();
    const hostResolution = shouldDiagnoseHostResolution(
      diagnostics.host,
      message
    )
      ? await diagnoseHostResolution(diagnostics.host)
      : undefined;
    writeBootstrapLog('error', 'Database connection attempt failed', {
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      connectionTimeout: diagnostics.connectionTimeout,
      error: message,
      hint: getConnectionHint(diagnostics.host, message, hostResolution),
      hostResolutionStatus: hostResolution?.status,
      resolvedAddresses: hostResolution?.addresses,
      hostResolutionError: hostResolution?.error
    });
    throw connectionError;
  }
}

// Create a proxy that lazily initializes the database connection
// This allows tests to mock the database before it's actually used
const dbProxy = new Proxy({} as DrizzleDatabase, {
  get(_, prop: string) {
    const database = getDatabase();
    const value = database[prop as keyof DrizzleDatabase];
    if (typeof value === 'function') {
      return value.bind(database);
    }
    return value;
  }
});

export const db = dbProxy;

// Export raw SQL connection for custom queries
export function getSqlConnection(): SQL {
  getDatabase(); // Ensure initialization
  if (!sqlConnection) {
    throw new Error('SQL connection not initialized');
  }
  return sqlConnection;
}

// Health check do banco
export async function checkDatabaseHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    // Execute simple query to test connection
    await db.execute(sql`SELECT 1`);

    const latencyMs = Math.round(performance.now() - start);
    return { status: 'ok', latencyMs };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'error',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  if (sqlConnection) {
    writeBootstrapLog('info', 'Closing database connection');
    try {
      await sqlConnection.close({ timeout: 5 });
    } catch {
      // Ignore close errors during shutdown
    }
    dbInstance = null;
    sqlConnection = null;
    connectionConfig = null;
    connectionError = null;
    hostResolutionCache.clear();
    writeBootstrapLog('info', 'Database connection closed');
    return;
  }

  hostResolutionCache.clear();
}
