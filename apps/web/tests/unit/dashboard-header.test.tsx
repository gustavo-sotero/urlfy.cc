import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import type { ReactNode } from 'react';

let headerImportCounter = 0;

async function importFreshModule<T>(modulePath: string, suffix: string) {
  return (await import(`${modulePath}?${suffix}`)) as T;
}

beforeAll(() => {
  if (
    typeof window !== 'undefined' &&
    typeof window.getComputedStyle !== 'function'
  ) {
    window.getComputedStyle = (_el: Element) =>
      ({
        paddingLeft: '0px',
        paddingRight: '0px',
        overflowX: 'visible',
        overflowY: 'visible'
      }) as unknown as CSSStyleDeclaration;
  }
});

const pushMock = mock(() => {});
const signOutMock = mock(async () => {});
const setQueryDataMock = mock(() => {});
const invalidateQueriesMock = mock(async () => {});
const redirectMock = mock(
  (_args: { href: string; locale: string }) => undefined
);

mock.module('next/navigation', () => ({
  redirect: () => {},
  permanentRedirect: () => {},
  notFound: () => {},
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/links',
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: 'link-1' })
}));

mock.module('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: setQueryDataMock,
    invalidateQueries: invalidateQueriesMock
  })
}));

mock.module('@/lib/session-provider', () => ({
  SESSION_QUERY_KEY: ['session'],
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthState: () => ({ isAuthenticated: true, isPending: false }),
  useSessionContext: () => ({
    data: null,
    isPending: false,
    error: null,
    refetch: async () => {},
    isAuthenticated: true
  })
}));

mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Common: {
        dashboard: 'Dashboard',
        language: 'Language',
        settings: 'Settings',
        logout: 'Logout',
        openMenu: 'Open menu',
        closeMenu: 'Close menu'
      },
      'Dashboard.sidebar': {
        dashboard: 'Dashboard',
        links: 'Links',
        analytics: 'Analytics',
        settings: 'Settings'
      }
    };

    return (key: string) => messages[namespace]?.[key] || key;
  })
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
  routing: { locales: ['en', 'pt-br'] },
  redirect: redirectMock,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/dashboard/links'
}));

mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuShortcut: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    asChild
  }: {
    children: ReactNode;
    onClick?: () => void;
    asChild?: boolean;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  DropdownMenuCheckboxItem: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuPortal: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuSub: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  )
}));

mock.module('@/lib/auth.client', () => ({
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: signOutMock,
  useSession: () => ({ data: null, isPending: false }),
  getSession: async () => ({ data: null, error: null }),
  resetPassword: async () => ({}),
  requestPasswordReset: async () => ({}),
  changePassword: async () => ({}),
  verifyEmail: async () => ({}),
  twoFactor: {},
  authClient: {
    signOut: signOutMock,
    useSession: () => ({ data: null, isPending: false }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: async () => undefined
  },
  default: {
    signOut: signOutMock,
    useSession: () => ({ data: null, isPending: false }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: async () => undefined
  }
}));

describe('Dashboard Header', () => {
  afterEach(() => {
    cleanup();
    pushMock.mockClear();
    signOutMock.mockClear();
    setQueryDataMock.mockClear();
    invalidateQueriesMock.mockClear();
    redirectMock.mockClear();
  });

  async function renderHeader() {
    const { Header } = await importFreshModule<
      typeof import('../../src/components/layout/header')
    >(
      '../../src/components/layout/header.tsx',
      `dashboard-header-${headerImportCounter++}`
    );

    render(
      <Header
        user={{
          name: 'Test User',
          email: 'test@example.com',
          image: null
        }}
      />
    );
  }

  it('renders the dashboard title and a single mobile menu trigger', async () => {
    await renderHeader();

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getAllByLabelText('Open menu').length).toBe(1);
  });

  it('opens the mobile drawer and shows dashboard navigation links', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getAllByText('Links').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
  });

  it('closes the mobile drawer when a navigation link is pressed', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    const navLinks = screen.getAllByText('Analytics');
    const mobileNavLink = navLinks[navLinks.length - 1];

    await act(async () => {
      fireEvent.click(mobileNavLink);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can reopen the mobile drawer after closing it', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    await act(async () => {
      fireEvent.click(screen.getAllByText('Analytics').at(-1) as Element);
    });

    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });

    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('clears the cached session before redirecting home on logout', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'));
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(setQueryDataMock).toHaveBeenCalledWith(['session'], null);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['session']
    });
    expect(pushMock).toHaveBeenCalledWith('/');
  });
});
