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

export function getDatabase(): DrizzleDatabase {
  if (connectionError) {
    throw connectionError;
  }

  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    connectionError = new Error('DATABASE_URL environment variable is not set');
    throw connectionError;
  }

  // Default to sslmode=prefer when the URL doesn't specify it.
  // This lets managed PostgreSQL (that requires TLS) work out of the box.
  const urlHasSSL = databaseUrl.includes('sslmode=');
  const connUrlPrefer = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=prefer`;
  const connUrlDisable = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=disable`;

  try {
    const max = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
    const idleTimeout = Number.parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT || '30',
      10
    );
    const connectionTimeout = Number.parseInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT || '10',
      10
    );

    const connect = (url: string) =>
      new SQL({
        url,
        max,
        idleTimeout,
        connectionTimeout
      });

    // Use native Bun SQL (PostgreSQL, MySQL or SQLite)
    try {
      sqlConnection = connect(connUrlPrefer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const shouldRetryPlain =
        !urlHasSSL && message.toLowerCase().includes('timeout');
      if (!shouldRetryPlain) throw err;

      console.warn(
        '⚠️ DB connect timeout with sslmode=prefer (auto). Retrying with sslmode=disable...'
      );
      sqlConnection = connect(connUrlDisable);
    }
    dbInstance = drizzle(sqlConnection, { schema });

    console.log('✅ Database connection established (Bun SQL)');
    return dbInstance;
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error
        : new Error('Failed to connect to database');
    console.error('❌ Failed to connect to database:', error);
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
    console.log('Closing database connection...');
    // Bun SQL doesn't have explicit close method, connection is managed by runtime
    dbInstance = null;
    sqlConnection = null;
    console.log('Database connection reference cleared');
  }
}
