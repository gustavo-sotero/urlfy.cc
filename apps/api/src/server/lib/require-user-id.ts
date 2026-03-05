// src/server/lib/require-user-id.ts

import { AppError, ErrorCode } from '@/server/lib/error-handler';

/**
 * Extract user ID from auth context, throwing if not authenticated.
 * Shared utility to avoid duplicating this function in multiple controllers.
 *
 * @param user - User object from auth middleware (may be null/undefined for guests)
 * @returns The user's ID string
 * @throws AppError with UNAUTHORIZED if user is not authenticated
 */
export function requireUserId(user: { id: string } | null | undefined): string {
  if (!user?.id) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required');
  }

  return user.id;
}
