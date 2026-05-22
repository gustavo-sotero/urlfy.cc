// packages/data/src/scripts/seed-smoke.ts
//
// Seeds a deterministic system link used exclusively for smoke tests.
//
// Short code:  repo
// Destination: https://github.com/gustavo-sotero/urlfy.cc
//
// This seed is idempotent (onConflictDoNothing) and runs automatically at the
// end of every migration cycle so the smoke link always exists regardless of
// whether the database was reset or freshly provisioned.
//
// 'repo' is in RESERVED_SLUGS so users cannot claim it via the API.
//
// GitHub Actions smoke test config (static, not real secrets):
//   PRODUCTION_SMOKE_SHORT_CODE          = repo
//   PRODUCTION_SMOKE_EXPECTED_LOCATION   = https://github.com/gustavo-sotero/urlfy.cc

import type { DrizzleDatabase } from '../index';
import { links } from '../schema/links';

export const SMOKE_SHORT_CODE = 'repo';
export const SMOKE_DESTINATION = 'https://github.com/gustavo-sotero/urlfy.cc';

export async function seedSmoke(db: DrizzleDatabase): Promise<void> {
  const result = await db
    .insert(links)
    .values({
      originalUrl: SMOKE_DESTINATION,
      shortCode: SMOKE_SHORT_CODE,
      redirectType: 302,
      isActive: true,
      isBanned: false
    })
    .onConflictDoNothing()
    .returning({ id: links.id });

  if (result.length > 0) {
    console.log(
      `✅ Smoke link seeded (/${SMOKE_SHORT_CODE} → ${SMOKE_DESTINATION})`
    );
  } else {
    console.log(`ℹ️  Smoke link already exists (/${SMOKE_SHORT_CODE}), skipped`);
  }
}
