import { Elysia } from 'elysia';
import { buildCspDirectives } from '@/lib/csp';
import { generateCspNonce } from '../lib/csp-nonce';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * CSP Middleware with Nonce-based Script Protection
 * Replaces unsafe-inline with cryptographically secure nonces
 *
 * @see https://content-security-policy.com/nonce/
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */
export const cspMiddleware = new Elysia({ name: 'csp' }).derive(({ set }) => {
  const nonce = generateCspNonce();

  const directives = buildCspDirectives({ nonce, isProduction });

  set.headers['content-security-policy'] = directives;
  set.headers['x-csp-nonce'] = nonce; // Custom header for Next.js to read

  return { cspNonce: nonce };
});
