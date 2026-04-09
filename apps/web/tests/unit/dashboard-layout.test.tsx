import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const headersMock = mock(async () => new Headers());
const getLocaleMock = mock(async () => 'pt-br');
const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('REDIRECT');
});
const getSessionMock = mock(async () => ({
  user: {
    name: 'Test User',
    email: 'test@example.com',
    image: null,
    emailVerified: true
  }
}));

mock.module('next/headers', () => ({
  headers: headersMock
}));

mock.module('next-intl/server', () => ({
  getLocale: getLocaleMock
}));

mock.module('@/i18n/routing', () => ({
  redirect: redirectMock
}));

mock.module('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock
    }
  }
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
    headersMock.mockClear();
    getLocaleMock.mockClear();
    redirectMock.mockClear();
    getSessionMock.mockClear();
  });

  it('forces a fresh session lookup before rendering the dashboard', async () => {
    const { default: DashboardLayout } = await import(
      '@/app/[locale]/(dashboard)/layout'
    );

    const element = await DashboardLayout({
      children: <div>Dashboard content</div>,
      params: Promise.resolve({ locale: 'pt-br' })
    });

    const markup = renderToStaticMarkup(element);

    expect(getSessionMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { disableCookieCache: true }
    });
    expect(markup).toContain('Dashboard content');
    expect(markup).toContain('Test User');
  });

  it('redirects unauthenticated users to the localized login page', async () => {
    getSessionMock.mockResolvedValueOnce(null);

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
  });

  it('renders the verification warning for unverified users', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: null,
        emailVerified: false
      }
    });

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
