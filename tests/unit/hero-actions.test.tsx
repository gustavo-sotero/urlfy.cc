/**
 * Unit tests for HeroActions component.
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { HeroActions } from '@/components/home/hero-actions';

// Create a mock function we can control
const mockUseAuthState = mock();

// Mock session provider
mock.module('@/lib/session-provider', () => ({
  useAuthState: mockUseAuthState
}));

describe('HeroActions', () => {
  afterEach(() => {
    cleanup();
    mockUseAuthState.mockReset();
  });

  it('shows loading state when session is pending', () => {
    mockUseAuthState.mockReturnValue({
      data: null,
      isPending: true,
      isAuthenticated: false
    });

    render(<HeroActions />);

    expect(screen.getByText('Carregando...')).toBeDefined();
  });

  it('shows dashboard button for authenticated users', () => {
    mockUseAuthState.mockReturnValue({
      data: { user: { id: '123' } },
      isPending: false,
      isAuthenticated: true
    });

    render(<HeroActions />);

    expect(screen.getByText('Ir para Dashboard')).toBeDefined();
  });

  it('shows signup and login buttons for guests', () => {
    mockUseAuthState.mockReturnValue({
      data: null,
      isPending: false,
      isAuthenticated: false
    });

    render(<HeroActions />);

    expect(screen.getByText('Come\u00e7ar gratuitamente')).toBeDefined();
    expect(screen.getByText('Fazer login')).toBeDefined();
  });
});
