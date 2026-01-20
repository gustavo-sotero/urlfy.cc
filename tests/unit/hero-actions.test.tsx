/**
 * Unit tests for HeroActions component
 */

import { describe, expect, it, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { HeroActions } from '@/components/home/hero-actions';

describe('HeroActions', () => {
  it('shows loading state when session is pending', () => {
    // Mock loading state
    mock.module('@/lib/auth.client', () => ({
      useSession: mock(() => ({
        data: null,
        isPending: true
      }))
    }));

    render(<HeroActions />);

    expect(screen.getByText('Carregando...')).toBeDefined();
  });

  it('shows dashboard button for authenticated users', () => {
    // Mock authenticated state
    mock.module('@/lib/auth.client', () => ({
      useSession: mock(() => ({
        data: { user: { id: '123', email: 'test@example.com' } },
        isPending: false
      }))
    }));

    render(<HeroActions />);

    expect(screen.getByText('Ir para Dashboard')).toBeDefined();
  });

  it('shows signup and login buttons for guests', () => {
    // Mock guest state
    mock.module('@/lib/auth.client', () => ({
      useSession: mock(() => ({
        data: null,
        isPending: false
      }))
    }));

    render(<HeroActions />);

    expect(screen.getByText('Começar gratuitamente')).toBeDefined();
    expect(screen.getByText('Fazer login')).toBeDefined();
  });
});
