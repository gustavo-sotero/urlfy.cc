/**
 * Unit tests for Navbar component
 */

import { Navbar } from '@/components/layout/navbar';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';

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
