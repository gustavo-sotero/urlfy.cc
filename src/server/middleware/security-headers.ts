/**
 * Security Headers Middleware
 * Applies comprehensive security headers to all responses
 */

import { Elysia } from 'elysia';
import { HEADERS_TO_REMOVE, SECURITY_HEADERS } from '@/server/config/security';

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
  for (const header of HEADERS_TO_REMOVE) {
    delete set.headers[header];
  }
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
