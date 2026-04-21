/**
 * ═════════════════════════════════════════════════════════════════════
 * MODULES - Central export for all feature modules
 * ═════════════════════════════════════════════════════════════════════
 *
 * Feature-based modular architecture following ElysiaJS best practices
 * Each module contains: controller, service, schema
 * ═════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════
// NOTE: This barrel is not consumed by any production code.
// All imports target individual module paths  (e.g. @/server/modules/links).
// Kept for tooling/IDE convenience with explicit re-exports only.
// ═══════════════════════════════════════════════════════════════════

// Admin Module
export {
  AdminModel,
  adminController,
  adminMessagesController,
  adminQueuesController,
  auditController
} from './admin';

// Analytics Module
export { AnalyticsModel, analyticsController } from './analytics';

// Auth Module
export { AuthModel, authController } from './auth';

// Common Schemas
export { CommonSchemas } from './common';

// Contact Module
export { ContactService, contactController } from './contact';

// Links Module
export {
  LinkLifecycleService,
  LinkService,
  LinksModel,
  linksController
} from './links';

// Users Module
export {
  consentController,
  meController,
  UsersModel
} from './users';
