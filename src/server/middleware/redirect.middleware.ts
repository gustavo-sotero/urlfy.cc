// src/server/middleware/redirect.middleware.ts
/**
 * ═════════════════════════════════════════════════════════════════════
 * REDIRECT MIDDLEWARE - Legacy Compatibility Layer
 * ═════════════════════════════════════════════════════════════════════
 * This file re-exports from the modular redirect/ directory for
 * backwards compatibility. All new code should import directly from:
 *
 *   import { handleRedirect } from '@/server/middleware/redirect';
 *
 * The modular structure is:
 *   redirect/
 *   ├── index.ts        - Main orchestration
 *   ├── validator.ts    - Request validation (host, depth)
 *   ├── resolver.ts     - Link resolution via internal API
 *   ├── error-handler.ts - Error code mapping and responses
 *   ├── analytics.ts    - Click event dispatch
 *   └── types.ts        - Shared type definitions
 * ═════════════════════════════════════════════════════════════════════
 */

export type {
  RedirectContext,
  RedirectErrorCode,
  ResolveResult,
  ValidationResult
} from './redirect';
// Re-export everything from the modular implementation
export {
  getPasswordToken,
  handleRedirect
} from './redirect';
