import { notFound } from 'next/navigation';

/**
 * Catch-all route for unknown locale-prefixed URLs.
 * Converts any unmatched path under /[locale]/ into a localized 404
 * rendered by apps/web/src/app/[locale]/not-found.tsx.
 * Explicit routes under [locale] take precedence over this catch-all
 * per Next.js App Router route resolution rules.
 */
export default function LocaleCatchAll(): never {
  notFound();
}
