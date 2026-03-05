import { AppError, ErrorCode } from './error-handler';

/**
 * Type-narrowing utility for controller handlers behind requireAuth middleware.
 *
 * Throws UNAUTHORIZED if user is not present. This should never happen at
 * runtime when requireAuth middleware is used, but it satisfies TypeScript
 * narrowing and provides a safety net.
 *
 * @example
 * ```ts
 * .get('/', async ({ user }) => {
 *   requireUser(user);
 *   // user is now narrowed to non-null
 *   return { id: user.id };
 * })
 * ```
 */
export function requireUser<T extends { id: string }>(
  user: T | null | undefined
): asserts user is T {
  if (!user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required');
  }
}
