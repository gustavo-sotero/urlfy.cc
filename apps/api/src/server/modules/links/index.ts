/**
 * ═════════════════════════════════════════════════════════════════════
 * LINKS MODULE - URL shortening core domain
 * ═════════════════════════════════════════════════════════════════════
 * Module: Links (Core Domain)
 * Spec: module-03-links.md
 * ═════════════════════════════════════════════════════════════════════
 */

export { LinkLifecycleService } from './link-lifecycle.service';
export { linksController } from './links.controller';
export {
  LINK_RESPONSE_EXAMPLE,
  LINK_STATS_EXAMPLE,
  type LinkCreateBodyType,
  LinksModel
} from './links.schema';
export { LinkService } from './links.service';
