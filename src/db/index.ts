// Bun SQL nativo para PostgreSQL
import { SQL } from 'bun';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from './schema';

// Type for the drizzle instance
type DrizzleDatabase = ReturnType<typeof drizzle>;

// Connection singleton
let dbInstance: DrizzleDatabase | null = null;
let sqlConnection: SQL | null = null;
let connectionError: Error | null = null;

// Connection configuration (computed lazily on first getDatabase() call)
let connectionConfig: {
  connUrlPrefer: string;
  connUrlDisable: string;
  urlHasSSL: boolean;
  max: number;
  idleTimeout: number;
  connectionTimeout: number;
} | null = null;

function getConnectionConfig() {
  if (connectionConfig) return connectionConfig;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const urlHasSSL = databaseUrl.includes('sslmode=');
  const connUrlPrefer = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=prefer`;
  const connUrlDisable = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=disable`;

  const max = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
  const idleTimeout = Number.parseInt(
    process.env.DB_POOL_IDLE_TIMEOUT || '30',
    10
  );
  const connectionTimeout = Number.parseInt(
    process.env.DB_POOL_CONNECTION_TIMEOUT || '10',
    10
  );

  connectionConfig = {
    connUrlPrefer,
    connUrlDisable,
    urlHasSSL,
    max,
    idleTimeout,
    connectionTimeout
  };
  return connectionConfig;
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
    const { connUrlPrefer } = getConnectionConfig();
    sqlConnection = createSqlConnection(connUrlPrefer);
    dbInstance = drizzle(sqlConnection, { schema });
    // NOTE: Connection is lazy — no actual TCP/TLS happens here.
    // Call initDatabase() to eagerly test connectivity and handle SSL fallback.
    return dbInstance;
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error
        : new Error('Failed to create database instance');
    console.error('❌ Failed to create database instance:', error);
    throw connectionError;
  }
}

/**
 * Eagerly tests database connectivity and handles SSL fallback.
 *
 * Bun SQL connections are lazy — `new SQL(...)` never opens a socket.
 * This function forces an actual connection by running `SELECT 1` and,
 * if the URL didn't include an explicit `sslmode=`, retries with
 * `sslmode=disable` when the TLS negotiation times out.
 *
 * Must be called during server startup (before serving requests).
 * Matches the proven pattern from docker/db-check.ts.
 */
export async function initDatabase(): Promise<void> {
  // Ensure lazy instances are created
  getDatabase();

  if (!sqlConnection) {
    throw new Error('SQL connection not initialized after getDatabase()');
  }

  const config = getConnectionConfig();

  try {
    // Force actual connection — this is where TLS negotiation happens
    await sqlConnection.unsafe('SELECT 1');
    console.log('✅ Database connection established (Bun SQL)');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Only retry with sslmode=disable if:
    // 1. sslmode was auto-added (not user-specified in DATABASE_URL)
    // 2. The error is a connection timeout (TLS negotiation hang)
    const isTimeout = message.toLowerCase().includes('timeout');
    const shouldRetryPlain = !config.urlHasSSL && isTimeout;

    if (!shouldRetryPlain) {
      connectionError = err instanceof Error ? err : new Error(message);
      throw connectionError;
    }

    console.warn(
      `⚠️  sslmode=prefer timed out (${message}). Re-connecting with sslmode=disable...`
    );

    // Close the broken connection to prevent leaked sockets
    try {
      await sqlConnection.close({ timeout: 0 });
    } catch {
      // Ignore close errors — connection is already broken
    }

    // Create new connection with sslmode=disable
    const newSql = createSqlConnection(config.connUrlDisable);

    try {
      await newSql.unsafe('SELECT 1');
    } catch (retryErr) {
      // Both sslmode=prefer AND sslmode=disable failed — fatal
      connectionError =
        retryErr instanceof Error
          ? retryErr
          : new Error('Failed to connect with sslmode=disable');
      throw connectionError;
    }

    // Replace global singletons
    sqlConnection = newSql;
    dbInstance = drizzle(sqlConnection, { schema });

    console.log(
      '✅ Database connection established (Bun SQL, sslmode=disable)'
    );
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
    console.log('Closing database connection...');
    try {
      await sqlConnection.close({ timeout: 5 });
    } catch {
      // Ignore close errors during shutdown
    }
    dbInstance = null;
    sqlConnection = null;
    connectionConfig = null;
    console.log('Database connection closed');
  }
}
