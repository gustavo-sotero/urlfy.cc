/**
 * ADMIN RESOLVER - Derives admin authority from linked GitHub account identity
 *
 * Admin authority is true if and only if:
 * 1. A userId is provided.
 * 2. The user has a linked Better Auth account with providerId === 'github'.
 * 3. That account's accountId matches ADMIN_GITHUB_ACCOUNT_ID env variable.
 *
 * Fails closed: any error during resolution denies admin access.
 */

import { db } from '@urlfy/data';
import { account as accountTable } from '@urlfy/data/schema/auth';
import { and, eq } from 'drizzle-orm';
import { getEnv } from '@/lib/env';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('admin-resolver');

/**
 * Determines whether the given userId is the single authorized admin by
 * checking whether they have a linked GitHub account whose accountId matches
 * the ADMIN_GITHUB_ACCOUNT_ID environment variable.
 *
 * Always returns false when:
 * - userId is falsy
 * - ADMIN_GITHUB_ACCOUNT_ID is not configured
 * - The user has no linked GitHub account
 * - The linked GitHub account ID does not match
 * - Any infrastructure error occurs (fail-closed)
 */
export async function resolveIsAdminByGitHubAccount(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;

  let adminAccountId: string | undefined;
  try {
    adminAccountId = getEnv().ADMIN_GITHUB_ACCOUNT_ID;
  } catch {
    // env not yet validated (e.g. build time) — fail closed
    return false;
  }

  if (!adminAccountId) return false;

  try {
    const [linkedAccount] = await db
      .select({ accountId: accountTable.accountId })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, userId),
          eq(accountTable.providerId, 'github')
        )
      )
      .limit(1);

    if (!linkedAccount) {
      logger.debug('Admin resolution: no linked GitHub account', { userId });
      return false;
    }

    const isAdmin = linkedAccount.accountId === adminAccountId;

    logger.debug('Admin resolution result', { userId, isAdmin });

    return isAdmin;
  } catch (error) {
    // Fail closed: infrastructure error must not grant admin access
    logger.error('Admin resolution failed — denying admin access', {
      userId,
      error
    });
    return false;
  }
}
