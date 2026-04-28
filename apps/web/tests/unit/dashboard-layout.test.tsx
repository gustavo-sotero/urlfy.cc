import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const headersMock = mock(
  async () => new Headers({ cookie: 'urlfy.session_token=abc123' })
);
const getLocaleMock = mock(async () => 'pt-br');
const sendVerificationEmailMock = mock(async () => undefined);
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

mock.module('next/navigation', () => ({
  redirect: () => {},
  permanentRedirect: () => {},
  notFound: () => {},
  useParams: () => ({}),
  usePathname: () => '/pt-br/dashboard',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams()
}));

mock.module('next-intl', () => ({
  useLocale: () => 'pt-br',
  useTranslations: (namespace: string) => {
    if (namespace !== 'Dashboard.verification') {
      return (key: string) => key;
    }

    const messages: Record<string, string> = {
      title: 'Verify your email address',
      description: 'Verify your email to keep account notifications reliable.',
      justSentTitle: 'Verification email sent',
      justSentDescription: 'We sent a verification email to {email}.',
      justSentHelp: 'Check your inbox and spam folder.',
      sending: 'Sending...',
      sent: 'Verification email sent',
      resend: 'Resend verification email',
      checkInbox: 'Check your inbox and spam folder.',
      errorEmail: 'We could not determine which email address to verify.',
      errorResend: 'We could not resend the verification email.'
    };

    return (key: string, values?: Record<string, string | number>) => {
      const template = messages[key] ?? key;
      return Object.entries(values ?? {}).reduce(
        (message, [token, value]) =>
          message.replace(`{${token}}`, String(value)),
        template
      );
    };
  }
}));

mock.module('next-intl/server', () => ({
  getLocale: getLocaleMock
}));

mock.module('@/i18n/routing', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  redirect: redirectMock,
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/dashboard'
}));

mock.module('@/lib/auth.client', () => ({
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => undefined,
  useSession: () => ({ data: null, isPending: false }),
  getSession: async () => ({ data: null, error: null }),
  resetPassword: async () => ({}),
  requestPasswordReset: async () => ({}),
  changePassword: async () => ({}),
  verifyEmail: async () => ({}),
  twoFactor: {},
  authClient: {
    useSession: () => ({ data: null }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: sendVerificationEmailMock
  },
  default: {
    useSession: () => ({ data: null }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: sendVerificationEmailMock
  }
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
    sendVerificationEmailMock.mockClear();
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
    expect(markup).toContain('data-dashboard-shell="authenticated"');
    expect(markup).toContain('data-dashboard-main="content"');
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

    expect(markup).toContain('Verify your email address');
    expect(markup).toContain('Resend verification email');
  });
});
