// Bun SQL nativo para PostgreSQL
import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

// Singleton da conexão
let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqlConnection: SQL | null = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    // Usa Bun SQL nativo (PostgreSQL, MySQL ou SQLite)
    sqlConnection = new SQL(databaseUrl);
    dbInstance = drizzle(sqlConnection, { schema });

    console.log("✅ Database connection established (Bun SQL)");
    return dbInstance;
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    throw error;
  }
}

export const db = getDatabase();

// Exporta conexão SQL bruta para queries customizadas
export function getSqlConnection(): SQL {
  getDatabase(); // Garante inicialização
  if (!sqlConnection) {
    throw new Error("SQL connection not initialized");
  }
  return sqlConnection;
}

// Health check do banco
export async function checkDatabaseHealth(): Promise<{
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    // Executa query simples para testar conexão
    await db.execute(sql`SELECT 1`);

    const latencyMs = Math.round(performance.now() - start);
    return { status: "ok", latencyMs };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "error",
      latencyMs,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  if (sqlConnection) {
    console.log("Closing database connection...");
    // Bun SQL doesn't have explicit close method, connection is managed by runtime
    dbInstance = null;
    sqlConnection = null;
    console.log("Database connection reference cleared");
  }
}
