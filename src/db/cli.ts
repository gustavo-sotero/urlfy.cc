import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// This file is for CLI tools that run with Node.js (like better-auth CLI)
// Runtime code should use src/db/index.ts which uses bun-sql
const client = postgres(process.env.DATABASE_URL as string);
export const db = drizzle(client);
