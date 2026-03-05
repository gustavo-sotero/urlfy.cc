import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { closeDatabase, getDatabase, initDatabase } from '../index';

async function main() {
  console.log('⏳ Running migrations...');

  try {
    await initDatabase();
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
