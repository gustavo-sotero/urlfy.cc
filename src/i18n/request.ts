// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { type Locale, routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // Import TS files directly for type-safety
    messages: (await import(`../messages/${locale}.ts`)).default
  };
});
