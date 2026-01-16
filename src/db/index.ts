// Bun SQL nativo para PostgreSQL
import { SQL } from 'bun';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from './schema';

// Type for the drizzle instance
type DrizzleDatabase = ReturnType<typeof drizzle>;

// Singleton da conexão
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

  try {
    // Usa Bun SQL nativo (PostgreSQL, MySQL ou SQLite)
    sqlConnection = new SQL({
      url: databaseUrl,
      max: Number.parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeout: Number.parseInt(
        process.env.DB_POOL_IDLE_TIMEOUT || '30',
        10
      ),
      connectionTimeout: Number.parseInt(
        process.env.DB_POOL_CONNECTION_TIMEOUT || '10',
        10
      )
    });
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

// Exporta conexão SQL bruta para queries customizadas
export function getSqlConnection(): SQL {
  getDatabase(); // Garante inicialização
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
    // Executa query simples para testar conexão
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
