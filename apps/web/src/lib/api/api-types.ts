/**
 * Eden Treaty type stub for @urlfy/api/types
 *
 * This file overrides the @urlfy/api/types resolution to prevent cross-workspace
 * TypeScript @/ path resolution failures.
 *
 * For full route-level type inference (recommended in CI), build apps/api first:
 *   cd apps/api && bunx tsc --build
 * Then update apps/web/tsconfig.json to remove the @urlfy/api/types path override.
 *
 * This stub provides the /api prefix structure so Eden Treaty's client.api works.
 */
import type { Elysia } from 'elysia';

// Minimal App type: preserves /api prefix for treaty<App>().api access.
// Routes are typed as generic (no specific type errors for individual endpoints).
// biome-ignore lint/suspicious/noExplicitAny: required for Eden Treaty compatibility
export type App = Elysia<'/api', any>;
