import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if a value is considered empty
 * @param value - Value to check
 * @returns true if the value should be filtered out
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}

/**
 * Remove empty/undefined/null values from an object
 * Useful for cleaning form data before API submission
 * @param obj - Object to clean
 * @returns New object without empty values
 * @example
 * const cleaned = removeEmptyFields({ name: 'John', age: '', city: null });
 * // Result: { name: 'John' }
 */
export function removeEmptyFields<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => !isEmpty(value))
  );
}

/**
 * Redirect type constants
 */
export const REDIRECT_TYPES = {
  PERMANENT: 301,
  TEMPORARY: 302
} as const;

export type RedirectType = (typeof REDIRECT_TYPES)[keyof typeof REDIRECT_TYPES];

/**
 * Safely parse redirect type from string to number
 * @param value - String value ('301' or '302')
 * @returns Numeric redirect type or undefined
 */
export function parseRedirectType(
  value?: string | null
): RedirectType | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return parsed === 301 || parsed === 302
    ? (parsed as RedirectType)
    : undefined;
}
