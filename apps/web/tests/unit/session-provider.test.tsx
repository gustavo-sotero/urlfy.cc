import { afterEach, describe, expect, it, mock } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const getSessionMock = mock(async () => ({
  data: {
    user: {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@example.com',
      image: null,
      isAdmin: true,
      twoFactorEnabled: true,
      emailVerified: true,
      lastLoginMethod: 'github'
    },
    session: {
      id: 'session-1',
      createdAt: '2026-05-07T00:00:00.000Z'
    }
  },
  error: null
}));

mock.module('@/lib/auth.client', () => ({
  authClient: {
    getSession: getSessionMock
  }
}));

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function SessionProbe() {
  const { useSessionContext } =
    require('@/lib/session-provider') as typeof import('@/lib/session-provider');
  const session = useSessionContext();

  return (
    <div>
      <span data-testid="pending">{String(session.isPending)}</span>
      <span data-testid="email">{session.data?.user.email ?? 'anonymous'}</span>
    </div>
  );
}

describe('SessionProvider', () => {
  afterEach(() => {
    cleanup();
    getSessionMock.mockClear();
  });

  it('StaticSessionProvider exposes hydrated session data without QueryClientProvider', async () => {
    const { StaticSessionProvider } = await import('@/lib/session-provider');

    render(
      <StaticSessionProvider
        initialData={{
          user: {
            id: 'user-1',
            name: 'Admin User',
            email: 'admin@example.com',
            image: null,
            isAdmin: true,
            twoFactorEnabled: true,
            emailVerified: true,
            lastLoginMethod: 'github'
          },
          session: {
            id: 'session-1',
            createdAt: '2026-05-07T00:00:00.000Z'
          }
        }}
      >
        <SessionProbe />
      </StaticSessionProvider>
    );

    expect(screen.getByTestId('pending').textContent).toBe('false');
    expect(screen.getByTestId('email').textContent).toBe('admin@example.com');
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('uses hydrated initial data without triggering an immediate session fetch', async () => {
    const { SessionProvider } = await import('@/lib/session-provider');

    renderWithQueryClient(
      <SessionProvider
        initialData={{
          user: {
            id: 'user-1',
            name: 'Admin User',
            email: 'admin@example.com',
            image: null,
            isAdmin: true,
            twoFactorEnabled: true,
            emailVerified: true,
            lastLoginMethod: 'github'
          },
          session: {
            id: 'session-1',
            createdAt: '2026-05-07T00:00:00.000Z'
          }
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByTestId('pending').textContent).toBe('false');
    expect(screen.getByTestId('email').textContent).toBe('admin@example.com');
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
