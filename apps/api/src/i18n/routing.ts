/**
 * Minimal i18n routing types for the API server.
 * Mirrors apps/web next-intl routing without the Next.js dependency.
 */

export type Locale = 'en' | 'pt-br';
export const locales = ['en', 'pt-br'] as const;
export const defaultLocale: Locale = 'en';
