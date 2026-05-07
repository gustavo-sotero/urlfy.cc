import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const updateUserMock = mock(async () => undefined);
const headersMock = mock(async () => new Headers());
const getServerSessionMock = mock(async () => ({
  user: {
    name: 'Admin User',
    email: 'admin@example.com',
    twoFactorEnabled: true,
    isAdmin: true
  },
  session: {
    id: 'session-1'
  }
}));

mock.module('next/headers', () => ({
  headers: headersMock
}));

mock.module('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));

mock.module('@/lib/server-session', () => ({
  getServerSession: getServerSessionMock
}));

mock.module('@/lib/auth.client', () => ({
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => undefined,
  useSession: () => ({ data: null, isPending: false }),
  getSession: async () => ({ data: null, error: null }),
  resetPassword: async () => ({}),
  requestPasswordReset: async () => ({}),
  changePassword: async () => ({}),
  verifyEmail: async () => ({}),
  twoFactor: {},
  authClient: {
    updateUser: updateUserMock,
    useSession: () => ({ data: null, isPending: false }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: async () => undefined
  },
  default: {
    updateUser: updateUserMock,
    useSession: () => ({ data: null, isPending: false }),
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: async () => undefined
  }
}));

mock.module('@/components/dashboard/settings/api-keys-manager', () => ({
  ApiKeysManager: () => <div data-testid="api-keys-manager" />
}));

mock.module('@/components/settings/backup-codes', () => ({
  BackupCodes: () => <div data-testid="backup-codes" />
}));

mock.module('@/components/settings/disable-two-factor', () => ({
  DisableTwoFactor: () => <div data-testid="disable-two-factor" />
}));

mock.module('@/components/settings/two-factor-setup', () => ({
  TwoFactorSetup: () => <div data-testid="two-factor-setup" />
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    headersMock.mockClear();
    getServerSessionMock.mockReset();
    getServerSessionMock.mockResolvedValue({
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        twoFactorEnabled: true,
        isAdmin: true
      },
      session: {
        id: 'session-1'
      }
    });
  });

  it('shows the disable 2FA actions for authorized admins when 2FA is enabled', async () => {
    const { default: SettingsPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/settings/page'
    );

    const markup = renderToStaticMarkup(await SettingsPage());

    expect(markup).toContain('data-testid="backup-codes"');
    expect(markup).toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="two-factor-setup"');
  });

  it('shows the 2FA setup flow when 2FA is disabled, regardless of admin status', async () => {
    getServerSessionMock.mockResolvedValue({
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        twoFactorEnabled: false,
        isAdmin: true
      },
      session: {
        id: 'session-1'
      }
    });

    const { default: SettingsPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/settings/page'
    );

    const markup = renderToStaticMarkup(await SettingsPage());

    expect(markup).toContain('data-testid="two-factor-setup"');
    expect(markup).not.toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="backup-codes"');
  });
});
