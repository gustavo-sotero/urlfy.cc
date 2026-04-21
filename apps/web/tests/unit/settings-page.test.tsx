import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const updateUserMock = mock(async () => undefined);
const useSessionContextMock = mock(() => ({
  data: {
    user: {
      name: 'Admin User',
      email: 'admin@example.com',
      twoFactorEnabled: true,
      isAdmin: true
    }
  },
  isPending: false
}));

mock.module('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));

mock.module('@/lib/auth.client', () => ({
  authClient: {
    updateUser: updateUserMock
  }
}));

mock.module('@/lib/session-provider', () => ({
  useSessionContext: useSessionContextMock
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
    useSessionContextMock.mockReset();
    useSessionContextMock.mockReturnValue({
      data: {
        user: {
          name: 'Admin User',
          email: 'admin@example.com',
          twoFactorEnabled: true,
          isAdmin: true
        }
      },
      isPending: false
    });
  });

  it('shows the disable 2FA actions for authorized admins when 2FA is enabled', async () => {
    const { default: SettingsPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/settings/page'
    );

    const markup = renderToStaticMarkup(<SettingsPage />);

    expect(markup).toContain('data-testid="backup-codes"');
    expect(markup).toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="two-factor-setup"');
  });

  it('shows the 2FA setup flow when 2FA is disabled, regardless of admin status', async () => {
    useSessionContextMock.mockReturnValue({
      data: {
        user: {
          name: 'Admin User',
          email: 'admin@example.com',
          twoFactorEnabled: false,
          isAdmin: true
        }
      },
      isPending: false
    });

    const { default: SettingsPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/settings/page'
    );

    const markup = renderToStaticMarkup(<SettingsPage />);

    expect(markup).toContain('data-testid="two-factor-setup"');
    expect(markup).not.toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="backup-codes"');
  });
});
