/**
 * ═════════════════════════════════════════════════════════════════════
 * CONTACT CONTROLLER - API endpoints for contact messages
 * ═════════════════════════════════════════════════════════════════════
 * Module: Contact System
 * Pattern: Elysia controller with strict rate limiting
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';
import { ContactModels } from './contact.schema';
import { ContactService } from './contact.service';

const logger = createLogger('contact-controller');

// ═══════════════════════════════════════════════════════════════════
// RATE LIMIT CONFIG
// ═══════════════════════════════════════════════════════════════════

const CONTACT_RATE_LIMIT = {
  points: 30, // 30 requests
  duration: 3600 // per hour (1 hour = 3600 seconds)
};

// ═══════════════════════════════════════════════════════════════════
// CONTACT CONTROLLER
// ═══════════════════════════════════════════════════════════════════

export const contactController = new Elysia({ prefix: '/contact' })
  .model(ContactModels)
  .post(
    '/',
    async ({ body, set, request }) => {
      // 1. Extract IP address
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

      // 2. Rate limiting (30 requests per hour per IP)
      const rateLimitResult = await rateLimiter.checkIPLimit(
        ip,
        CONTACT_RATE_LIMIT
      );

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(CONTACT_RATE_LIMIT.points);
      set.headers['X-RateLimit-Remaining'] = String(rateLimitResult.remaining);
      set.headers['X-RateLimit-Reset'] = String(
        Math.floor(rateLimitResult.resetTime / 1000)
      );

      if (!rateLimitResult.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = String(rateLimitResult.retryAfter || 3600);

        logger.warn('Rate limit exceeded for contact form', {
          ip,
          remaining: rateLimitResult.remaining
        });

        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many contact submissions. Please try again later.'
          }
        };
      }

      // 3. Validate consent
      if (!body.consent) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message:
              'You must agree to the data storage consent to submit this form.'
          }
        };
      }

      // 4. Extract user agent
      const userAgent = request.headers.get('user-agent') || undefined;

      // 5. Create message
      try {
        const result = await ContactService.create(body, ip, userAgent);

        logger.info('Contact message created', {
          id: result.id,
          email: body.email,
          telegramSent: result.telegramSent
        });

        set.status = 201;
        return {
          success: true,
          message:
            'Message received successfully. We will get back to you soon!'
        };
      } catch (error) {
        logger.error('Failed to create contact message', {
          error: error instanceof Error ? error.message : String(error),
          email: body.email
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to send message. Please try again later.'
          }
        };
      }
    },
    {
      body: 'contact.create',
      response: {
        201: 'contact.response',
        400: 'contact.response',
        429: 'contact.response',
        500: 'contact.response'
      },
      detail: {
        summary: 'Submit contact form',
        description:
          'Submit a contact message. Rate limited to 30 requests per hour per IP. Requires explicit consent for LGPD compliance.',
        tags: ['Contact']
      }
    }
  );
