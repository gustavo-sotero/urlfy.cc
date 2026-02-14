/**
 * Locale Resolution Utilities
 *
 * Handles locale resolution for emails and server-side operations.
 * Always prioritizes user's saved locale preference from database.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema/auth';
import { type AppLocale, defaultLocale, isAppLocale } from '@/emails/types';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('locale');

/**
 * Fetches user's locale from database
 *
 * @param userId - User ID to fetch locale for
 * @returns User's locale or default locale if not found/invalid
 */
export async function getUserLocale(userId: string): Promise<AppLocale> {
  try {
    const result = await db
      .select({ locale: user.locale })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userLocale = result[0]?.locale;

    // Validate and return user's locale, fallback to default if invalid
    return isAppLocale(userLocale) ? userLocale : defaultLocale;
  } catch (error) {
    logger.warn('Failed to fetch locale for user', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return defaultLocale;
  }
}

/**
 * Resolves locale with fallback logic
 *
 * Priority:
 * 1. Explicitly provided locale (if valid)
 * 2. Default locale
 *
 * @param locale - Locale to validate
 * @returns Valid AppLocale
 */
export function resolveLocale(locale: unknown): AppLocale {
  return isAppLocale(locale) ? locale : defaultLocale;
}

/**
 * Get locale from user email address by querying database
 * Useful when only email is available (e.g., in Better-Auth callbacks)
 *
 * @param email - User's email address
 * @returns User's locale or default locale
 */
export async function getLocaleByEmail(email: string): Promise<AppLocale> {
  try {
    const result = await db
      .select({ locale: user.locale })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    const userLocale = result[0]?.locale;
    return isAppLocale(userLocale) ? userLocale : defaultLocale;
  } catch (error) {
    logger.warn('Failed to fetch locale by email', {
      error: error instanceof Error ? error.message : String(error)
    });
    return defaultLocale;
  }
}
