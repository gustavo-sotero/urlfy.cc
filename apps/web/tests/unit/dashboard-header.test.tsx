import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';

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
const redirectMock = mock(
  (_args: { href: string; locale: string }) => undefined
);

mock.module('next/navigation', () => ({
  usePathname: () => '/dashboard/links',
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: 'link-1' })
}));

mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Common: {
        dashboard: 'Dashboard',
        settings: 'Settings',
        logout: 'Logout'
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

mock.module('@/lib/auth.client', () => ({
  signOut: signOutMock
}));

describe('Dashboard Header', () => {
  afterEach(() => {
    cleanup();
    pushMock.mockClear();
    signOutMock.mockClear();
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
    expect(screen.getAllByLabelText('Menu').length).toBe(1);
  });

  it('opens the mobile drawer and shows dashboard navigation links', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Menu'));
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getAllByText('Links').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
  });

  it('closes the mobile drawer when a navigation link is pressed', async () => {
    await renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Menu'));
    });

    const navLinks = screen.getAllByText('Analytics');
    const mobileNavLink = navLinks[navLinks.length - 1];

    await act(async () => {
      fireEvent.click(mobileNavLink);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
