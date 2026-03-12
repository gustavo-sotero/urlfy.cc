import type { User } from '@/lib/auth';

export function getTestUserFromHeaders(headers: Headers): User | null {
  if (process.env.NODE_ENV !== 'test') return null;

  const testUserId = headers.get('x-test-user-id');
  if (!testUserId) return null;

  const emailVerifiedHeader = headers.get('x-test-email-verified');
  // Default to false if header not present (matches real behavior)
  const emailVerified = emailVerifiedHeader === 'true';

  const roleHeader = headers.get('x-test-user-role');
  const role = roleHeader === 'admin' ? 'admin' : 'user';

  const twoFactorEnabled = headers.get('x-test-2fa-enabled') === 'true';
  const now = new Date();

  return {
    id: testUserId,
    email: headers.get('x-test-user-email') || `${testUserId}@test.local`,
    name: headers.get('x-test-user-name') || 'Test User',
    emailVerified,
    image: null,
    role,
    twoFactorEnabled,
    linksQuota: 100,
    linksCount: 0,
    bannedAt: null,
    bannedReason: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  } as User;
}
