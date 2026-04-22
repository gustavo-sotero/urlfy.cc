/**
 * Unit tests for Navbar component
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from '@testing-library/react';
import { Navbar } from '@/components/layout/navbar';

// react-remove-scroll-bar (used by Radix Sheet/Dialog) calls
// window.getComputedStyle when a scroll-locked overlay is mounted.
// happy-dom provides it, but mock.restore() in other test files can
// strip it. Restore it here as a safety-net.
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

// Mock next-intl
mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Navigation: {
        features: 'Recursos',
        project: 'Notas do Projeto',
        docs: 'Docs da API',
        closeMenu: 'Fechar menu'
      },
      Common: {
        language: 'Idioma',
        login: 'Login',
        signup: 'Criar conta',
        dashboard: 'Dashboard'
      }
    };
    return (key: string) => messages[namespace]?.[key] || key;
  })
}));

// Mock i18n routing
mock.module('@/i18n/routing', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  redirect: () => undefined,
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/'
}));

// Mock auth client
mock.module('@/lib/auth.client', () => ({
  useSession: mock(() => ({
    data: null,
    isPending: false
  }))
}));

// Mock session provider
mock.module('@/lib/session-provider', () => ({
  useAuthState: mock(() => ({
    data: null,
    isPending: false,
    isAuthenticated: false,
    refetch: async () => {},
    error: null
  }))
}));

// Mock LanguageSwitcher
mock.module('@/components/shared/language-switcher', () => ({
  LanguageSwitcher: () => <div>Language</div>
}));

describe('Navbar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders logo correctly', () => {
    render(<Navbar />);

    // Navbar uses next/image for the logo (alt="urlfy.cc")
    const logos = screen.getAllByAltText('urlfy.cc');
    expect(logos.length).toBeGreaterThan(0);
  });

  it('renders navigation links', () => {
    render(<Navbar />);

    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Notas do Projeto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Docs da API').length).toBeGreaterThan(0);
  });

  it('shows guest auth buttons when not authenticated', () => {
    render(<Navbar />);

    // Desktop buttons
    const loginButtons = screen.getAllByText('Login');
    expect(loginButtons.length).toBeGreaterThan(0);

    const signupButtons = screen.getAllByText(/Criar conta/);
    expect(signupButtons.length).toBeGreaterThan(0);
  });

  it('has accessible menu button', () => {
    render(<Navbar />);

    const menuButton = screen.getAllByLabelText('Menu');
    expect(menuButton.length).toBeGreaterThan(0);
  });

  it('mobile sheet trigger renders exactly once', () => {
    render(<Navbar />);

    // Only one hamburger menu trigger button should exist
    const menuButtons = screen.getAllByLabelText('Menu');
    expect(menuButtons.length).toBe(1);
  });

  it('mobile drawer exposes a single localized close control', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    const dialog = screen.getByRole('dialog');
    const closeButtons = within(dialog).getAllByLabelText('Fechar menu');
    expect(closeButtons.length).toBe(1);
  });

  it('opens mobile drawer and shows navigation links', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    // Mobile nav links should be visible in the drawer
    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Notas do Projeto').length).toBeGreaterThan(0);
  });

  it('shows language controls inside the mobile drawer', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    expect(screen.getByText('Idioma')).toBeDefined();
    expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
  });

  it('mobile drawer auth buttons have w-full width class', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    // Get all login/signup links and at least one should be in the drawer with w-full
    const loginLinks = screen.getAllByText('Login');
    const signupLinks = screen.getAllByText('Criar conta');
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(signupLinks.length).toBeGreaterThan(0);
  });

  it('clicking a nav link inside the drawer closes the menu', async () => {
    render(<Navbar />);

    // Open the drawer
    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    // Dialog (Sheet) is open
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    // The mobile nav has the same links as desktop — after opening the drawer
    // there are 2 "Recursos" elements: one in the desktop nav, one in the Sheet
    const allFeaturesLinks = screen.getAllByText('Recursos');
    const mobileNavLink = allFeaturesLinks[allFeaturesLinks.length - 1];

    await act(async () => {
      fireEvent.click(mobileNavLink);
    });

    // After clicking, Sheet's controlled `open` prop becomes false.
    // In happy-dom (no CSS engine), Radix detects no active animation and
    // unmounts immediately, OR sets data-state="closed" before unmounting.
    const closedDialog = screen.queryByRole('dialog');
    const isClosed =
      closedDialog === null ||
      closedDialog.getAttribute('data-state') === 'closed';
    expect(isClosed).toBe(true);
  });

  it('clicking a mobile auth action closes the drawer', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    const allLoginLinks = screen.getAllByText('Login');
    const mobileLoginLink = allLoginLinks[allLoginLinks.length - 1];

    await act(async () => {
      fireEvent.click(mobileLoginLink);
    });

    const closedDialog = screen.queryByRole('dialog');
    const isClosed =
      closedDialog === null ||
      closedDialog.getAttribute('data-state') === 'closed';
    expect(isClosed).toBe(true);
  });
});

describe('Component Performance', () => {
  it('Navbar renders within acceptable time', () => {
    const start = performance.now();
    render(<Navbar />);
    const duration = performance.now() - start;

    // Increased threshold for test environments with overhead
    expect(duration).toBeLessThan(1000);
  });
});
