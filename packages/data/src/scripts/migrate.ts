import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { closeDatabase, getDatabase, initDatabase } from '../index';

const MIGRATION_TIMEOUT_S = Number.parseInt(
  process.env.MIGRATION_TIMEOUT ?? '120',
  10
);
const DB_CHECK_TIMEOUT_S = Number.parseInt(
  process.env.DB_CHECK_TIMEOUT ?? '10',
  10
);
const RETRY_INTERVAL_MS = 3000;

/**
 * Waits for the database to become reachable before running migrations.
 *
 * PostgreSQL is provisioned as a separate Dokploy service and may not be
 * ready immediately when this container starts. We poll with a short
 * interval up to MIGRATION_TIMEOUT seconds rather than failing instantly.
 */
async function waitForDatabase(): Promise<void> {
  const deadline = Date.now() + MIGRATION_TIMEOUT_S * 1000;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      await initDatabase();
      console.log(`✅ Database reachable (attempt ${attempt})`);
      return;
    } catch (err) {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      if (remaining <= 0) {
        throw new Error(
          `Database not reachable after ${MIGRATION_TIMEOUT_S}s: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.log(
        `⏳ Database not ready (attempt ${attempt}, ${remaining}s left): ${err instanceof Error ? err.message : String(err)}`
      );
      // Close any partial connection state before the next attempt
      await closeDatabase();
      await Bun.sleep(RETRY_INTERVAL_MS);
    }
  }
}

async function main() {
  console.log(
    `⏳ Running migrations... (timeout: ${MIGRATION_TIMEOUT_S}s, check-timeout: ${DB_CHECK_TIMEOUT_S}s)`
  );

  try {
    await waitForDatabase();
    const db = getDatabase();

    // This will run migrations on the database, skipping the ones already applied
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Migrations completed successfully');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

main();
