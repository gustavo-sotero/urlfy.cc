/**
 * Security Headers Middleware
 * Applies comprehensive security headers to all responses
 */

import { Elysia } from 'elysia';

/**
 * Security headers configuration
 * Following OWASP best practices
 */
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // Next.js + Swagger UI
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.scalar.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests'
  ].join('; '),

  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
} as const;

/**
 * Security headers middleware for ElysiaJS
 * Automatically applied to all API responses
 */
export const securityHeadersMiddleware = new Elysia({
  name: 'security-headers'
}).onAfterHandle(({ set }) => {
  // Apply all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    set.headers[key] = value;
  });

  // Remove potentially dangerous headers
  delete set.headers['X-Powered-By'];
  delete set.headers.Server;
});

/**
 * Middleware specifically for production environments
 * Adds stricter policies
 */
export const productionSecurityHeaders = new Elysia({ name: 'prod-security' })
  .use(securityHeadersMiddleware)
  .onAfterHandle(({ set }) => {
    if (process.env.NODE_ENV === 'production') {
      // Enforce HTTPS in production
      set.headers['Strict-Transport-Security'] =
        'max-age=63072000; includeSubDomains; preload';
    }
  });
