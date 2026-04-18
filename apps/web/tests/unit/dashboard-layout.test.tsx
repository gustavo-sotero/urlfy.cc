import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const headersMock = mock(
  async () => new Headers({ cookie: 'urlfy.session_token=abc123' })
);
const getLocaleMock = mock(async () => 'pt-br');
const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('REDIRECT');
});
const fetchMock = mock(
  async () =>
    new Response(
      JSON.stringify({
        user: {
          name: 'Test User',
          email: 'test@example.com',
          image: null,
          emailVerified: true
        },
        session: {
          id: 'session-1',
          userId: 'user-1'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
);
const originalFetch = global.fetch;
const originalApiInternalUrl = process.env.API_INTERNAL_URL;

mock.module('next/headers', () => ({
  headers: headersMock,
  // Include cookies so this mock doesn't clobber sibling test files that need it
  cookies: async () => ({ get: () => undefined })
}));

mock.module('next-intl/server', () => ({
  getLocale: getLocaleMock
}));

mock.module('@/i18n/routing', () => ({
  redirect: redirectMock
}));

mock.module('@/components/dashboard/verification-warning', () => ({
  VerificationWarning: () => <div data-testid="verification-warning" />
}));

mock.module('@/components/layout/header', () => ({
  Header: ({ user }: { user: { name?: string | null } }) => (
    <div data-testid="header">{user.name ?? 'anonymous'}</div>
  )
}));

mock.module('@/components/layout/sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />
}));

describe('DashboardLayout', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    headersMock.mockClear();
    getLocaleMock.mockClear();
    redirectMock.mockClear();
    fetchMock.mockClear();
  });

  it('forces a fresh session lookup before rendering the dashboard', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.API_INTERNAL_URL = 'http://api:3001';

    const { default: DashboardLayout } = await import(
      '@/app/[locale]/(dashboard)/layout'
    );

    const element = await DashboardLayout({
      children: <div>Dashboard content</div>,
      params: Promise.resolve({ locale: 'pt-br' })
    });

    const markup = renderToStaticMarkup(element);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(markup).toContain('Dashboard content');
    expect(markup).toContain('Test User');
  });

  it('redirects unauthenticated users to the localized login page', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.API_INTERNAL_URL = 'http://api:3001';
    headersMock.mockResolvedValueOnce(new Headers());

    const { default: DashboardLayout } = await import(
      '@/app/[locale]/(dashboard)/layout'
    );

    await expect(
      DashboardLayout({
        children: <div>Dashboard content</div>,
        params: Promise.resolve({ locale: 'pt-br' })
      })
    ).rejects.toThrow('REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith({
      href: '/login',
      locale: 'pt-br'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the verification warning for unverified users', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.API_INTERNAL_URL = 'http://api:3001';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            name: 'Test User',
            email: 'test@example.com',
            image: null,
            emailVerified: false
          },
          session: {
            id: 'session-1',
            userId: 'user-1'
          }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    const { default: DashboardLayout } = await import(
      '@/app/[locale]/(dashboard)/layout'
    );

    const element = await DashboardLayout({
      children: <div>Dashboard content</div>,
      params: Promise.resolve({ locale: 'pt-br' })
    });

    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('data-testid="verification-warning"');
  });
});
