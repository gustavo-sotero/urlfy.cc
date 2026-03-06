/**
 * Eden Treaty type stub used only inside apps/web.
 *
 * This keeps web independent from apps/api internals at compile time while
 * preserving the /api namespace shape (`client.api.*`) expected by callers.
 */
import type { Elysia } from 'elysia';

// Minimal App type: preserves /api prefix for treaty<App>().api access.
// Routes are typed as generic (no specific type errors for individual endpoints).
// biome-ignore lint/suspicious/noExplicitAny: required for Eden Treaty compatibility
export type App = Elysia<'/api', any>;
