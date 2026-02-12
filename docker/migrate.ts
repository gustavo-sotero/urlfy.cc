/**
 * Standalone Migration Script for Production
 *
 * This script is copied into the Docker image and runs migrations
 * using drizzle-orm's programmatic migrator with Bun SQL.
 *
 * Key behavior: It checks if there are pending migrations BEFORE
 * applying anything. If all migrations are already applied, it exits
 * immediately (exit code 0) without doing any work.
 *
 * Usage:
 *   bun run migrate.ts
 *   MIGRATION_DRY_RUN=true bun run migrate.ts  (preview only)
 *
 * Exit codes:
 *   0 - Success (migrations applied or nothing to do)
 *   1 - Error (migration failed)
 */

import { SQL } from 'bun';
import { sql as sqlQuery } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY_RUN = process.env.MIGRATION_DRY_RUN === 'true';
const MIGRATIONS_FOLDER = './drizzle';

/**
 * Reads the local migration journal to get the list of all migration tags.
 */
function getLocalMigrationTags(): string[] {
  try {
    const journalPath = join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
    return (journal.entries ?? []).map((e: { tag: string }) => e.tag);
  } catch {
    // If journal doesn't exist, count SQL files as fallback
    const sqlFiles = readdirSync(MIGRATIONS_FOLDER).filter((f) =>
      f.endsWith('.sql')
    );
    return sqlFiles.map((f) => f.replace('.sql', ''));
  }
}

/**
 * Queries the database for already-applied migration hashes/tags.
 * Returns the count of applied migrations, or -1 if the table doesn't exist (first run).
 */
async function getAppliedMigrationCount(
  db: ReturnType<typeof drizzle>
): Promise<number> {
  try {
    const result = await db.execute<{ count: number }>(
      sqlQuery`SELECT count(*)::int as count FROM drizzle.__drizzle_migrations`
    );
    return result?.[0]?.count ?? 0;
  } catch {
    // Table doesn't exist yet = first run, all migrations are pending
    return -1;
  }
}

async function runMigrations(
  db: ReturnType<typeof drizzle>,
  localTags: string[]
) {
  const appliedCount = await getAppliedMigrationCount(db);
  const pendingCount =
    appliedCount === -1 ? localTags.length : localTags.length - appliedCount;

  if (appliedCount >= 0) {
    console.log(`   Applied: ${appliedCount} | Pending: ${pendingCount}`);
  } else {
    console.log('   First run — all migrations are pending');
  }

  if (pendingCount <= 0) {
    console.log('✅ Database is up to date — no migrations to apply');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log(`🔍 DRY RUN — ${pendingCount} migration(s) would be applied:`);
    for (const tag of localTags.slice(appliedCount === -1 ? 0 : appliedCount)) {
      console.log(`   → ${tag}`);
    }
    process.exit(0);
  }

  console.log(`⏳ Applying ${pendingCount} migration(s)...`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('✅ Migrations completed successfully');
  process.exit(0);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const localTags = getLocalMigrationTags();
  console.log(
    `📂 Found ${localTags.length} migration file(s) in ${MIGRATIONS_FOLDER}/`
  );

  if (localTags.length === 0) {
    console.log('✅ No migration files found — nothing to do');
    process.exit(0);
  }

  let sql: SQL | null = null;

  // Default to sslmode=prefer when the URL doesn't specify it.
  // This lets managed PostgreSQL (that requires TLS) work without manual config.
  const urlHasSSL = databaseUrl.includes('sslmode=');
  const connUrlPrefer = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=prefer`;
  const connUrlDisable = urlHasSSL
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=disable`;

  const createConnection = (url: string, timeout = 10) =>
    new SQL({
      url,
      max: 1, // Single connection for migrations
      connectionTimeout: timeout,
      idleTimeout: 5
    });

  try {
    // Try with sslmode=prefer first, fallback to disable on any error.
    // Dokploy internal DBs sometimes hang when the client attempts TLS,
    // and drizzle wraps the underlying timeout as "Failed query: ..." which
    // hides the original error message — so we retry on ANY failure.
    if (!urlHasSSL) {
      try {
        sql = createConnection(connUrlPrefer, 5);
        const db = drizzle(sql);
        // Quick connectivity test through drizzle
        await db.execute(sqlQuery`SELECT 1`);
        // Connection works with prefer, continue with this db
        return await runMigrations(db, localTags);
      } catch (preferErr) {
        const msg =
          preferErr instanceof Error ? preferErr.message : String(preferErr);
        console.log(
          `⚠️  sslmode=prefer failed (${msg}), retrying with sslmode=disable...`
        );
        // Close the hung connection
        try {
          await sql?.close();
        } catch {
          /* ignore */
        }
        sql = createConnection(connUrlDisable);
        const db = drizzle(sql);
        return await runMigrations(db, localTags);
      }
    } else {
      sql = createConnection(databaseUrl);
      const db = drizzle(sql);
      return await runMigrations(db, localTags);
    }
  } catch (error) {
    console.error(
      '❌ Migration failed:',
      error instanceof Error ? error.message : error
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
