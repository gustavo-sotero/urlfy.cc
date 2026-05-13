import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

type MockAdminSession = {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
    lastLoginMethod: string | null;
  };
  session: {
    id: string;
    userId: string;
    createdAt: string;
    adminElevationProvider?: string | null;
    adminElevationExpiresAt?: string | null;
  };
};

const ADMIN_LAYOUT_PATH = '../../src/app/(admin)/layout.tsx';
let adminLayoutImportCounter = 0;

async function importFreshAdminLayout() {
  return import(
    `${ADMIN_LAYOUT_PATH}?test=${adminLayoutImportCounter++}`
  ) as Promise<{
    default: typeof import('@/app/(admin)/layout').default;
  }>;
}

function createMockSession(
  overrides?: Partial<{
    user: Partial<MockAdminSession['user']>;
    session: Partial<MockAdminSession['session']>;
  }>
): MockAdminSession {
  const userOverrides = overrides?.user ?? {};
  const sessionOverrides = overrides?.session ?? {};
  const userId = userOverrides.id ?? 'admin-1';

  return {
    user: {
      id: userId,
      email: 'admin@example.com',
      isAdmin: true,
      lastLoginMethod: 'github',
      ...userOverrides
    },
    session: {
      id: 'session-admin-1',
      userId,
      createdAt: new Date().toISOString(),
      adminElevationProvider: 'github',
      adminElevationExpiresAt: new Date(
        Date.now() + 30 * 60 * 1000
      ).toISOString(),
      ...sessionOverrides
    }
  };
}

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
  async (): Promise<MockAdminSession | null> => createMockSession()
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
  headers: headersMock,
  cookies: async () => ({ get: () => undefined })
}));

mock.module('next/navigation', () => ({
  redirect: redirectMock,
  permanentRedirect: () => {},
  notFound: () => {},
  useParams: () => ({}),
  usePathname: () => '/admin',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams()
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
      async (): Promise<MockAdminSession | null> => createMockSession()
    );
  });

  it('renders the admin shell for the authorized admin session', async () => {
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AdminLayout } = await importFreshAdminLayout();

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

    const { default: AdminLayout } = await importFreshAdminLayout();

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
      async (): Promise<MockAdminSession | null> =>
        createMockSession({
          user: {
            id: 'user-2',
            email: 'user@example.com',
            isAdmin: false
          },
          session: {
            id: 'session-user-2',
            userId: 'user-2',
            adminElevationProvider: null,
            adminElevationExpiresAt: null
          }
        })
    );
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AdminLayout } = await importFreshAdminLayout();

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

  it('redirects admin users without a valid elevation claim to GitHub reauth', async () => {
    fetchMock.mockImplementation(
      async (): Promise<MockAdminSession | null> =>
        createMockSession({
          session: {
            adminElevationProvider: null,
            adminElevationExpiresAt: null
          }
        })
    );
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AdminLayout } = await importFreshAdminLayout();

    await expect(
      AdminLayout({
        children: <div>Admin content</div>
      })
    ).rejects.toThrow('REDIRECT:/login?callbackUrl=/admin&reauth=github');

    expect(redirectMock).toHaveBeenCalledWith(
      '/login?callbackUrl=/admin&reauth=github'
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_access_denied',
        userId: 'admin-1',
        metadata: expect.objectContaining({
          reason: 'admin_elevation_missing_or_expired',
          elevationProvider: null,
          elevationExpiresAt: null
        })
      })
    );
  });
});
