import { randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically secure nonce for CSP
 * Must be called once per request and passed to both CSP header and inline scripts
 *
 * @returns Base64-encoded random nonce string (22 characters)
 * @see https://content-security-policy.com/nonce/
 */
export function generateCspNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Type-safe nonce storage for request context
 * Augment Elysia's Context with this interface in middleware
 */
export interface CspNonceContext {
  cspNonce: string;
}
