import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import type { ReactNode } from 'react';

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
  SESSION_QUERY_KEY: ['session']
}));

mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Common: {
        dashboard: 'Dashboard',
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
  redirect: redirectMock,
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/dashboard/links'
}));

mock.module('@/components/shared/language-switcher', () => ({
  LanguageSwitcher: () => <div>Language</div>
}));

mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
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
    )
}));

mock.module('@/lib/auth.client', () => ({
  signOut: signOutMock
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
    const { Header } = await import('@/components/layout/header');

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
