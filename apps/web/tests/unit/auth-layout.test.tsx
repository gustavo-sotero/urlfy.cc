import { afterEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

type MockSessionResponse = {
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

const AUTH_LAYOUT_PATH = '../../src/app/[locale]/(auth)/layout.tsx';
let authLayoutImportCounter = 0;

async function importFreshAuthLayout() {
  return import(
    `${AUTH_LAYOUT_PATH}?test=${authLayoutImportCounter++}`
  ) as Promise<{
    default: typeof import('@/app/[locale]/(auth)/layout').default;
  }>;
}

function createMockSessionResponse(
  overrides?: Partial<{
    user: Partial<MockSessionResponse['user']>;
    session: Partial<MockSessionResponse['session']>;
  }>
): MockSessionResponse {
  const userOverrides = overrides?.user ?? {};
  const userId = userOverrides.id ?? 'user-1';

  return {
    user: {
      id: userId,
      email: 'user@example.com',
      isAdmin: true,
      ...userOverrides
    },
    session: {
      id: 'session-1',
      userId,
      ...(overrides?.session ?? {})
    }
  };
}

const headersMock = mock(
  async () =>
    new Headers({
      cookie: 'urlfy.session_token=auth-token',
      'user-agent': 'bun-test-agent'
    })
);
const redirectMock = mock((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});
const fetchMock = mock(
  async (): Promise<MockSessionResponse | null> => createMockSessionResponse()
);
const originalFetch = global.fetch;
const originalApiInternalUrl = process.env.API_INTERNAL_URL;
const originalInternalApiSecret = process.env.INTERNAL_API_SECRET;

mock.module('next-intl', () => ({
  useLocale: () => 'pt-br',
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Common: {
        language: 'Idioma'
      }
    };

    return (key: string) => messages[namespace]?.[key] ?? key;
  }
}));

function createJsonFetchStub(): typeof fetch {
  return (async () => {
    const session = await fetchMock();

    if (!session) {
      return new Response(null, { status: 401 });
    }

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as unknown as typeof fetch;
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
  usePathname: () => '/pt-br/login',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams()
}));

mock.module('@/i18n/routing', () => ({
  routing: {
    locales: ['en', 'pt-br'],
    defaultLocale: 'en'
  },
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
  redirect: () => undefined,
  usePathname: () => '/pt-br/login',
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
    prefetch: async () => undefined
  })
}));

describe('AuthLayout', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    process.env.INTERNAL_API_SECRET = originalInternalApiSecret;
    headersMock.mockReset();
    headersMock.mockImplementation(
      async () =>
        new Headers({
          cookie: 'urlfy.session_token=auth-token',
          'user-agent': 'bun-test-agent'
        })
    );
    redirectMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async (): Promise<MockSessionResponse | null> =>
        createMockSessionResponse()
    );
  });

  it('redirects authenticated users to the localized dashboard by default', async () => {
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';

    const { default: AuthLayout } = await importFreshAuthLayout();

    await expect(
      AuthLayout({
        children: <div>Login page</div>,
        params: Promise.resolve({ locale: 'pt-br' })
      })
    ).rejects.toThrow('REDIRECT:/pt-br/dashboard');

    expect(redirectMock).toHaveBeenCalledWith('/pt-br/dashboard');
  });

  it('allows authenticated users through when admin GitHub reauth is required', async () => {
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';
    headersMock.mockResolvedValueOnce(
      new Headers({
        cookie: 'urlfy.session_token=auth-token',
        'user-agent': 'bun-test-agent',
        'x-urlfy-auth-reauth': 'github'
      })
    );

    const { default: AuthLayout } = await importFreshAuthLayout();

    const element = await AuthLayout({
      children: <div>Login page</div>,
      params: Promise.resolve({ locale: 'pt-br' })
    });

    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Login page');
    expect(markup).toContain('Idioma: Português');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('still redirects non-admin users during a GitHub reauth request', async () => {
    fetchMock.mockImplementation(
      async (): Promise<MockSessionResponse | null> =>
        createMockSessionResponse({
          user: {
            id: 'user-2',
            email: 'user2@example.com',
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
    headersMock.mockResolvedValueOnce(
      new Headers({
        cookie: 'urlfy.session_token=auth-token',
        'user-agent': 'bun-test-agent',
        'x-urlfy-auth-reauth': 'github'
      })
    );

    const { default: AuthLayout } = await importFreshAuthLayout();

    await expect(
      AuthLayout({
        children: <div>Login page</div>,
        params: Promise.resolve({ locale: 'pt-br' })
      })
    ).rejects.toThrow('REDIRECT:/pt-br/dashboard');

    expect(redirectMock).toHaveBeenCalledWith('/pt-br/dashboard');
  });
});
