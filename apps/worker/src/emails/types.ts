/**
 * Email i18n Types - standalone worker version
 * Defines AppLocale without requiring @/i18n/routing (Next.js-specific)
 */

export type AppLocale = 'en' | 'pt-br';

/**
 * Type guard to check if a value is a valid AppLocale
 */
export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'pt-br';
}

/**
 * Get default locale
 */
export const defaultLocale: AppLocale = 'en';
