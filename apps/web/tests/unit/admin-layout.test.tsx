import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

type MockAdminSession = {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
  session: {
    id: string;
    userId: string;
  };
};

const headersMock = mock(
  async () =>
    new Headers({
      cookie: 'urlfy.session_token=admin-token',
      'user-agent': 'bun-test-agent'
    })
);
const redirectMock = mock((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});
const auditLogMock = mock(async () => undefined);
const fetchMock = mock(
  async (): Promise<MockAdminSession | null> => ({
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      isAdmin: true
    },
    session: {
      id: 'session-admin-1',
      userId: 'admin-1'
    }
  })
);
const originalFetch = global.fetch;
const originalApiInternalUrl = process.env.API_INTERNAL_URL;
const originalInternalApiSecret = process.env.INTERNAL_API_SECRET;

function createJsonFetchStub(): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(await fetchMock()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })) as unknown as typeof fetch;
}

mock.module('next/headers', () => ({
  headers: headersMock
}));

mock.module('next/navigation', () => ({
  redirect: redirectMock
}));

mock.module('@/components/admin/layout/admin-header', () => ({
  AdminHeader: () => <div data-testid="admin-header" />
}));

mock.module('@/components/admin/layout/admin-sidebar', () => ({
  AdminSidebar: ({ className }: { className?: string }) => (
    <aside data-testid="admin-sidebar" className={className}>
      Sidebar
    </aside>
  )
}));

mock.module('@/server/lib/ip', () => ({
  getClientIpFromHeaders: () => '127.0.0.1'
}));

mock.module('@/server/services/audit.service', () => ({
  auditLogService: {
    log: auditLogMock
  }
}));

describe('AdminLayout', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    process.env.INTERNAL_API_SECRET = originalInternalApiSecret;
    headersMock.mockClear();
    redirectMock.mockClear();
    auditLogMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async (): Promise<MockAdminSession | null> => ({
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          isAdmin: true
        },
        session: {
          id: 'session-admin-1',
          userId: 'admin-1'
        }
      })
    );
  });

  it('renders the admin shell for the authorized admin session', async () => {
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AdminLayout } = await import('@/app/(admin)/layout');

    const element = await AdminLayout({
      children: <div>Admin content</div>
    });

    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Admin content');
    expect(markup).toContain('data-testid="admin-header"');
    expect(markup).toContain('data-testid="admin-sidebar"');
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_access_granted',
        userId: 'admin-1'
      })
    );
  });

  it('redirects unauthenticated users to the admin login URL', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';
    headersMock.mockResolvedValueOnce(new Headers());

    const { default: AdminLayout } = await import('@/app/(admin)/layout');

    await expect(
      AdminLayout({
        children: <div>Admin content</div>
      })
    ).rejects.toThrow('REDIRECT:/login?callbackUrl=/admin');

    expect(redirectMock).toHaveBeenCalledWith('/login?callbackUrl=/admin');
    expect(auditLogMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects authenticated non-admin users to the dashboard', async () => {
    fetchMock.mockImplementation(
      async (): Promise<MockAdminSession | null> => ({
        user: {
          id: 'user-2',
          email: 'user@example.com',
          isAdmin: false
        },
        session: {
          id: 'session-user-2',
          userId: 'user-2'
        }
      })
    );
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AdminLayout } = await import('@/app/(admin)/layout');

    await expect(
      AdminLayout({
        children: <div>Admin content</div>
      })
    ).rejects.toThrow('REDIRECT:/dashboard');

    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_access_denied',
        userId: 'user-2',
        metadata: expect.objectContaining({
          reason: 'not_authorized_admin_account'
        })
      })
    );
  });
});
