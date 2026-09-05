#!/usr/bin/env bun

/**
 * ═════════════════════════════════════════════════════════════════════
 * ACCOUNT ISSUER BACKFILL (Better Auth 1.7 expand-and-contract)
 * ═════════════════════════════════════════════════════════════════════
 * Better Auth 1.7 keys `account` rows by the compound identity
 * (issuer, accountId). Existing rows have no issuer, so the migration
 * sequence is:
 *
 *   1. Generated migration: ADD COLUMN issuer (nullable)   ← drizzle-kit
 *   2. This backfill script (idempotent)                   ← this file
 *   3. Generated migration: ALTER COLUMN issuer SET NOT NULL
 *      + CREATE UNIQUE INDEX (issuer, account_id)          ← drizzle-kit
 *
 * The drizzle migrator applies every pending migration inside a single
 * transaction, so the backfill CANNOT be interleaved by running migrate()
 * twice with manual steps in between. Instead, scripts/migrate.ts executes
 * the full train in explicit phases:
 *
 *   migrate → backfill (this module) → migrate
 *
 * Migration SQL files are generated EXCLUSIVELY by drizzle-kit and are
 * never hand-edited (see .github/instructions/migrations.instructions.md);
 * data backfills live in versioned scripts like this one.
 *
 * Backfill rules (provider-scoped identity, matching Better Auth's
 * createLocalAccountIssuer / createOAuthAccountIssuer and
 * @urlfy/data/schema/account-identity):
 *   - provider_id = 'credential'  -> local:credential
 *   - all other providers         -> local:oauth:<providerId>
 *
 * Idempotency: rows already carrying a non-empty issuer are left untouched.
 *
 * CLI usage (standalone): bun run src/scripts/backfill-account-issuer.ts
 * Guards (STANDALONE CLI RUNS ONLY): refuses non-local DATABASE_URL hosts
 * unless BACKFILL_ACKNOWLEDGE_REMOTE=1. The guard lives in main() and is
 * NOT applied when scripts/migrate.ts imports backfillAccountIssuer() —
 * the deploy orchestrator owns database targeting and calls the function
 * directly with its own connection.
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { type DrizzleDatabase, db } from '../index';
import {
  localOAuthAccountIssuer,
  resolveAccountIssuer
} from '../schema/account-identity';
import { account } from '../schema/auth';

const CREDENTIAL_PROVIDER_ID = 'credential';
export const REMOTE_ACK_ENV_VAR = 'BACKFILL_ACKNOWLEDGE_REMOTE';

function isLocalHost(host: string): boolean {
  // Explicit allow-list instead of substring matching: a broad heuristic
  // like host.includes('test') would let any hostname containing 'test'
  // (e.g. 'prod-test-replica.example.com') bypass the remote guard.
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.test') // reserved documentation TLD
  );
}

/** Standalone-CLI guard: fail fast on non-local databases without an opt-in.
 *
 * Scopes to standalone CLI runs only — scripts/migrate.ts imports
 * backfillAccountIssuer() directly (the deploy orchestrator owns database
 * targeting), so this never blocks the deploy train.
 */
function assertSafeStandaloneEnvironment(): void {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error(
      '❌ Refusing to run backfill: DATABASE_URL is not set or unparsable.'
    );
    process.exit(1);
  }

  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    console.error(
      '❌ Refusing to run backfill: DATABASE_URL is not a valid URL.'
    );
    process.exit(1);
  }

  if (!isLocalHost(host) && process.env[REMOTE_ACK_ENV_VAR] !== '1') {
    console.error(
      `❌ Refusing to run backfill: DATABASE_URL host "${host}" is not a local host.\n` +
        `   Direct CLI runs against a remote database must opt in with ${REMOTE_ACK_ENV_VAR}=1.\n` +
        `   (Deploy migrations run through scripts/migrate.ts, which calls this module directly.)`
    );
    process.exit(1);
  }
}

async function countRowsNeedingBackfill(
  database: DrizzleDatabase
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(account)
    .where(or(isNull(account.issuer), eq(account.issuer, '')));

  return row?.count ?? 0;
}

async function runBackfill(database: DrizzleDatabase): Promise<void> {
  // 1. Credential accounts -> local namespace.
  await database
    .update(account)
    .set({ issuer: resolveAccountIssuer(CREDENTIAL_PROVIDER_ID) })
    .where(
      and(
        eq(account.providerId, CREDENTIAL_PROVIDER_ID),
        or(isNull(account.issuer), eq(account.issuer, ''))
      )
    );

  // 2. Every non-credential provider -> deterministic OAuth namespace.
  //    Provider IDs in this project are URI-safe (github, google), so the
  //    same percent-encoding used by better-auth is a no-op for them. Rows
  //    with non-URI-safe provider IDs would need an explicit map here BEFORE
  //    the NOT NULL migration runs — the query below surfaces them instead
  //    of silently writing a namespace better-auth would not recognize.
  const nonCredentialIssuers = await database
    .select({
      id: account.id,
      providerId: account.providerId
    })
    .from(account)
    .where(
      and(
        sql`${account.providerId} <> ${CREDENTIAL_PROVIDER_ID}`,
        or(isNull(account.issuer), eq(account.issuer, ''))
      )
    );

  for (const row of nonCredentialIssuers) {
    await database
      .update(account)
      .set({ issuer: localOAuthAccountIssuer(row.providerId) })
      .where(eq(account.id, row.id));
  }
}

async function verifyBackfill(database: DrizzleDatabase): Promise<void> {
  const rows = await database
    .select({
      providerId: account.providerId,
      issuer: account.issuer,
      count: sql<number>`count(*)::int`
    })
    .from(account)
    .groupBy(account.providerId, account.issuer)
    .orderBy(account.providerId, account.issuer);

  // 1. Every row must carry a non-empty issuer.
  const emptyIssuer = rows.filter(
    (row) => !row.issuer || row.issuer.length === 0
  ).length;

  // 2. Every issuer must match the expected provider-scoped namespace —
  //    a non-empty-but-wrong issuer would silently break Better Auth 1.7
  //    account-owner lookups and is not caught by the empty check above.
  const wrongNamespace = rows.filter(
    (row) => row.issuer !== resolveAccountIssuer(row.providerId)
  );

  console.table(rows);

  if (emptyIssuer > 0 || wrongNamespace.length > 0) {
    throw new Error(
      `Backfill verification failed: ${emptyIssuer} group(s) with an empty ` +
        `issuer and ${wrongNamespace.length} group(s) with an unexpected namespace ` +
        `(every row must equal resolveAccountIssuer(providerId)).` +
        (wrongNamespace.length > 0
          ? ` Offending (providerId, issuer) pairs: ${wrongNamespace
              .slice(0, 5)
              .map((row) => `(${row.providerId}, ${row.issuer})`)
              .join(', ')}.`
          : '')
    );
  }

  // 3. Better Auth 1.7 keys accounts by (issuer, accountId) and migration
  //    0008 enforces it with a unique index. Detect duplicate identity groups
  //    here and fail with actionable guidance instead of an opaque SQL error.
  const duplicates = await database
    .select({ issuer: account.issuer, accountId: account.accountId })
    .from(account)
    .groupBy(account.issuer, account.accountId)
    .having(sql`count(*) > 1`);

  if (duplicates.length > 0) {
    throw new Error(
      `Backfill verification failed: ${duplicates.length} duplicate (issuer, accountId) ` +
        `identity group(s) found. The NOT NULL + unique index migration (0008) would fail ` +
        `on them. Inspect with: SELECT issuer, account_id, COUNT(*) FROM "account" ` +
        `GROUP BY issuer, account_id HAVING COUNT(*) > 1; and reconcile the duplicates ` +
        `before re-running the migration train.`
    );
  }

  console.log('✅ Account issuer backfill verified');
}

/**
 * Idempotent backfill of the Better Auth 1.7 account issuer identity.
 * Executed by scripts/migrate.ts between the two drizzle-kit generated
 * migrations (expand phase). Safe to run repeatedly: rows with a non-empty
 * issuer are never rewritten.
 */
export async function backfillAccountIssuer(
  database: DrizzleDatabase
): Promise<{ backfilled: number }> {
  const pending = await countRowsNeedingBackfill(database);

  if (pending === 0) {
    console.log('ℹ️  No account rows need issuer backfill — idempotent no-op.');
  } else {
    console.log(`⏳ Backfilling issuer for ${pending} account row(s)...`);
    await runBackfill(database);
  }

  await verifyBackfill(database);

  return { backfilled: pending };
}

async function main(): Promise<void> {
  assertSafeStandaloneEnvironment();

  try {
    await backfillAccountIssuer(db);
    process.exit(0);
  } catch (error) {
    console.error('❌ Account issuer backfill failed:', error);
    process.exit(1);
  }
}

// Only auto-run when executed directly as a CLI script.
if (import.meta.main) {
  main();
}
