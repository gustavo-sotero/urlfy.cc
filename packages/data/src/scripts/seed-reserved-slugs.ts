// src/db/scripts/seed-reserved-slugs.ts
// Script to seed reserved slugs into the database

import { db } from '../cli';
import {
  getReservedSlugReason,
  RESERVED_SLUGS,
  reservedSlugs
} from '../schema/reserved-slugs';

/**
 * Seeds the reserved_slugs table with the predefined list of reserved slugs
 * Uses ON CONFLICT DO NOTHING to be idempotent
 */
async function seedReservedSlugs() {
  console.log('🌱 Seeding reserved slugs...');

  const slugsToInsert = RESERVED_SLUGS.map((slug) => ({
    slug,
    reason: getReservedSlugReason(slug)
  }));

  try {
    const result = await db
      .insert(reservedSlugs)
      .values(slugsToInsert)
      .onConflictDoNothing()
      .returning();

    console.log(`✅ Inserted ${result.length} new reserved slugs`);
    console.log(
      `ℹ️  Total slugs defined: ${RESERVED_SLUGS.length}, skipped existing: ${
        RESERVED_SLUGS.length - result.length
      }`
    );
  } catch (error) {
    console.error('❌ Failed to seed reserved slugs:', error);
    throw error;
  }
}

// Run if executed directly
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1]?.includes('seed-reserved-slugs');

if (isMainModule) {
  seedReservedSlugs()
    .then(() => {
      console.log('🎉 Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedReservedSlugs };
