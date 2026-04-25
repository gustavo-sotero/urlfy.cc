import { notFound } from 'next/navigation';

/**
 * Catch-all route for unknown locale-prefixed URLs.
 * Converts any unmatched path under /[locale]/ into a localized 404.
 */
export default function LocaleCatchAll(): never {
  notFound();
}
