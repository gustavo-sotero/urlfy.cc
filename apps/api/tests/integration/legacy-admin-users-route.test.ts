process.env.ADMIN_GITHUB_ACCOUNT_ID =
  process.env.ADMIN_GITHUB_ACCOUNT_ID ||
  'legacy-route-test-admin-github-account-id-00000000';

import { describe, expect, test } from 'bun:test';

describe('Legacy admin user-management route retirement', () => {
  test('GET /api/users is not mounted; /api/admin/users is the canonical admin route', async () => {
    const { api } = await import('@/server/index');

    const response = await api.handle(
      new Request('http://localhost/api/users', {
        method: 'GET'
      })
    );

    expect(response.status).toBe(404);
  });
});
