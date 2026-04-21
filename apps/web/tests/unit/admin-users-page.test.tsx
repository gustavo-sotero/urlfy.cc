import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const refetchMock = mock(async () => undefined);
const banMutateAsyncMock = mock(async (_userId: string) => undefined);
const unbanMutateAsyncMock = mock(async (_userId: string) => undefined);

const useUsersMock = mock(() => ({
  data: {
    data: [
      {
        id: 'user-1',
        name: 'Admin Candidate',
        email: 'admin@example.com',
        role: 'user',
        isAdmin: true,
        banned: false,
        bannedReason: null,
        bannedAt: null,
        twoFactorEnabled: false,
        linksQuota: 100,
        linksCount: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ],
    meta: {
      total: 1,
      page: 1,
      perPage: 20,
      lastPage: 1,
      hasMore: false
    }
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchMock
}));

const useBanUserMock = mock(() => ({
  mutateAsync: banMutateAsyncMock,
  isPending: false
}));

const useUnbanUserMock = mock(() => ({
  mutateAsync: unbanMutateAsyncMock,
  isPending: false
}));

mock.module('@/lib/hooks/use-admin', () => ({
  useUsers: useUsersMock,
  useBanUser: useBanUserMock,
  useUnbanUser: useUnbanUserMock
}));

mock.module('@/components/query-error', () => ({
  QueryError: ({ title }: { title: string }) => <div>{title}</div>
}));

mock.module('@/components/shared/confirm-dialog', () => ({
  ConfirmDialog: () => null
}));

mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    useUsersMock.mockReset();
    useUsersMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'user-1',
            name: 'Admin Candidate',
            email: 'admin@example.com',
            role: 'user',
            isAdmin: true,
            banned: false,
            bannedReason: null,
            bannedAt: null,
            twoFactorEnabled: false,
            linksQuota: 100,
            linksCount: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z'
          }
        ],
        meta: {
          total: 1,
          page: 1,
          perPage: 20,
          lastPage: 1,
          hasMore: false
        }
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock
    });
  });

  it('shows derived admin access and no promotion or demotion controls', async () => {
    const { default: AdminUsersPage } = await import(
      '@/app/(admin)/admin/users/page'
    );

    const markup = renderToStaticMarkup(<AdminUsersPage />);

    expect(markup).toContain('Autorizado');
    expect(markup).toContain('Banir usuário');
    expect(markup).toContain('Reativar usuário');
    expect(markup).not.toContain('Promover');
    expect(markup).not.toContain('Demover');
    expect(markup).not.toContain('Rebaixar');
  });
});
