/**
 * ═════════════════════════════════════════════════════════════════════
 * CONTACT CONTROLLER - API endpoints for contact messages
 * ═════════════════════════════════════════════════════════════════════
 * Module: Contact System
 * Pattern: Elysia controller with strict rate limiting
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { getRateLimit } from '@/server/config/rate-limits';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { getClientIp } from '@/server/lib/ip';
import { rateLimiter } from '@/server/lib/rate-limiter';
import { createLogger } from '@/server/lib/telemetry';
import { ContactModels } from './contact.schema';
import { ContactService } from './contact.service';

const logger = createLogger('contact-controller');
const contactRateLimit = getRateLimit('CONTACT_SUBMIT');
const contactRateLimitConfig = {
  points: contactRateLimit.max,
  duration: Math.floor(contactRateLimit.windowMs / 1000),
  ...(contactRateLimit.failClosed !== undefined
    ? { failClosed: contactRateLimit.failClosed }
    : {})
};

export const contactController = new Elysia({ prefix: '/contact' })
  .model(ContactModels)
  .post(
    '/',
    async ({ body, set, request }) => {
      // 1. Extract IP address using centralized trusted-proxy-aware helper
      const ip = getClientIp(request);

      // 2. Rate limiting from the canonical shared policy registry
      const rateLimitResult = await rateLimiter.checkIPLimit(
        ip,
        contactRateLimitConfig
      );

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(contactRateLimitConfig.points);
      set.headers['X-RateLimit-Remaining'] = String(rateLimitResult.remaining);
      set.headers['X-RateLimit-Reset'] = String(
        Math.floor(rateLimitResult.resetTime / 1000)
      );

      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for contact form', {
          remaining: rateLimitResult.remaining
        });

        throw new AppError(
          ErrorCode.RATE_LIMITED,
          'Too many contact submissions. Please try again later.'
        );
      }

      // 3. Validate consent
      if (!body.consent) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'You must agree to the data storage consent to submit this form.'
        );
      }

      // 4. Extract user agent
      const userAgent = request.headers.get('user-agent') || undefined;

      // 5. Create message
      const result = await ContactService.create(body, ip, userAgent);

      logger.info('Contact message created', {
        id: result.id,
        telegramSent: result.telegramSent
      });

      set.status = 201;
      return {
        success: true,
        data: {
          message:
            'Message received successfully. We will get back to you soon!'
        }
      };
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
