/**
 * Unit tests for Navbar component
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { Navbar } from '@/components/layout/navbar';

// Mock next-intl
mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Navigation: {
        features: 'Recursos',
        project: 'O Projeto',
        docs: 'API Docs'
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
