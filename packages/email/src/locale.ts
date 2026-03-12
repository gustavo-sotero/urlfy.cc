/**
 * Locale Resolution Utilities
 *
 * Handles locale resolution for emails and server-side operations.
 * Always prioritizes user's saved locale preference from database.
 */

import { db } from '@urlfy/data';
import { user } from '@urlfy/data/schema/auth';
import { createLogger } from '@urlfy/telemetry';
import { eq } from 'drizzle-orm';
import { type AppLocale, defaultLocale, isAppLocale } from './types';

const logger = createLogger('locale');

export async function getUserLocale(userId: string): Promise<AppLocale> {
  try {
    const result = await db
      .select({ locale: user.locale })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userLocale = result[0]?.locale;
    return isAppLocale(userLocale) ? userLocale : defaultLocale;
  } catch (error) {
    logger.warn('Failed to fetch locale for user', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return defaultLocale;
  }
}

export function resolveLocale(locale: unknown): AppLocale {
  return isAppLocale(locale) ? locale : defaultLocale;
}

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
