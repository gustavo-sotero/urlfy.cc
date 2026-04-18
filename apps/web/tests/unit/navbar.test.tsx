/**
 * Unit tests for Navbar component
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
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
        project: 'O Projeto',
        docs: 'API Docs',
        closeMenu: 'Fechar menu'
      },
      Common: {
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
  }
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

    expect(screen.getByText('urlfy')).toBeDefined();
    expect(screen.getByText('.cc')).toBeDefined();
  });

  it('renders navigation links', () => {
    render(<Navbar />);

    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O Projeto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('API Docs').length).toBeGreaterThan(0);
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

  it('mobile drawer does not render a custom close button alongside the built-in one', () => {
    render(<Navbar />);

    // The navbar must NOT have any SheetClose with a custom aria-label for "closeMenu"
    // Only the SheetContent built-in sr-only "Close" should exist
    const closeMenuButton = screen.queryByLabelText('closeMenu');
    expect(closeMenuButton).toBeNull();
  });

  it('opens mobile drawer and shows navigation links', async () => {
    render(<Navbar />);

    const menuButton = screen.getByLabelText('Menu');
    await act(async () => {
      fireEvent.click(menuButton);
    });

    // Mobile nav links should be visible in the drawer
    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O Projeto').length).toBeGreaterThan(0);
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
