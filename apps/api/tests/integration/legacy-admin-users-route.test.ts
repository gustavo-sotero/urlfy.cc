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

  test('POST /api/auth/admin/set-role is not mounted; Better Auth role mutation routes are retired', async () => {
    const { api } = await import('@/server/index');

    const response = await api.handle(
      new Request('http://localhost/api/auth/admin/set-role', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'legacy-user',
          role: 'admin'
        })
      })
    );

    expect(response.status).toBe(404);
  });

  test('GET /api/internal/docs/merged.json does not advertise retired Better Auth admin routes', async () => {
    const { api } = await import('@/server/index');

    const response = await api.handle(
      new Request('http://localhost/api/internal/docs/merged.json', {
        method: 'GET'
      })
    );

    expect(response.status).toBe(200);

    const spec = (await response.json()) as {
      paths?: Record<string, unknown>;
    };

    expect(spec.paths?.['/admin/set-role']).toBeUndefined();
    expect(spec.paths?.['/admin/list-users']).toBeUndefined();
    expect(spec.paths?.['/admin/ban-user']).toBeUndefined();
    expect(spec.paths?.['/admin/unban-user']).toBeUndefined();
    expect(spec.paths?.['/admin/impersonate-user']).toBeUndefined();
  });
});
