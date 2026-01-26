/**
 * ═══════════════════════════════════════════════════════════════════
 * PUBLIC API MODULE - Export barrel
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import { v1LinksController } from './v1-links.controller';

export { v1LinksController };

/**
 * Public API V1 - Versioned API for external clients
 *
 * This router is separate from the internal dashboard API to ensure:
 * - Stable contracts for external consumers
 * - Independent versioning (v1, v2, etc.)
 * - Clear documentation for public endpoints
 */
export const publicApiV1 = new Elysia({
  prefix: '/v1',
  detail: {
    tags: ['Public API V1']
  }
})
  // Mount public controllers (they will use requireApiKey guard internally)
  .use(v1LinksController);
