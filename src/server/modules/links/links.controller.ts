/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS CONTROLLER - HTTP routes for link management
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Pattern: Elysia instance as controller, delegates to sub-controllers
 * Spec: module-03-links.md
 *
 * Architecture:
 * - Public routes: Guest-accessible endpoints (validation, preview, QR, password)
 * - Create routes: Link creation (guest or authenticated)
 * - Protected routes: CRUD operations (requires authentication)
 * - Stats routes: Analytics and statistics (requires authentication)
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import {
  createLinkController,
  protectedLinksController
} from './controllers/protected.controller';
// Import sub-controllers
import { publicLinksController } from './controllers/public.controller';
import { statsLinksController } from './controllers/stats.controller';
import { LinksModel } from './links.schema';

// ═══════════════════════════════════════════════════════════════════
// LINKS CONTROLLER - Combined routes from sub-controllers
// ═════════════════════════════════════════════════════════════════════

/**
 * Main Links Controller
 *
 * Combines all sub-controllers:
 * - publicLinksController: Guest-accessible routes (validation, preview, QR, password)
 * - createLinkController: Link creation (guest or authenticated)
 * - protectedLinksController: CRUD operations (authenticated)
 * - statsLinksController: Analytics and statistics (authenticated)
 */
export const linksController = new Elysia({ prefix: '/links' })
  .use(LinksModel)
  .use(publicLinksController)
  .use(createLinkController)
  .use(protectedLinksController)
  .use(statsLinksController);
