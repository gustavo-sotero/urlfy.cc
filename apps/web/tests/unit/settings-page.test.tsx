import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const SETTINGS_PAGE_PATH =
  '../../src/app/[locale]/(dashboard)/dashboard/settings/page.tsx';
let settingsPageImportCounter = 0;

async function importFreshSettingsPage() {
  return import(
    `${SETTINGS_PAGE_PATH}?test=${settingsPageImportCounter++}`
  ) as Promise<{
    default: typeof import('@/app/[locale]/(dashboard)/dashboard/settings/page').default;
  }>;
}

const updateUserMock = mock(async () => undefined);
const headersMock = mock(
  async () =>
    new Headers({
      cookie: 'urlfy.session_token=settings-token',
      'user-agent': 'bun-test-agent'
    })
);
const fetchSessionMock = mock(async () => ({
  user: {
    name: 'Admin User',
    email: 'admin@example.com',
    twoFactorEnabled: true,
    isAdmin: true
  },
  session: {
    id: 'session-1',
    userId: 'admin-1'
  }
}));
const originalFetch = global.fetch;
const originalApiInternalUrl = process.env.API_INTERNAL_URL;
const originalInternalApiSecret = process.env.INTERNAL_API_SECRET;

function createJsonFetchStub(): typeof fetch {
  return (async () => {
    const session = await fetchSessionMock();

    if (!session) {
      return new Response(null, { status: 401 });
    }

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as unknown as typeof fetch;
}

mock.module('next/headers', () => ({
  headers: headersMock
}));

mock.module('next-intl', () => ({
  useTranslations: () => (key: string) => key
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
    global.fetch = createJsonFetchStub();
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';
    headersMock.mockClear();
    headersMock.mockResolvedValue(
      new Headers({
        cookie: 'urlfy.session_token=settings-token',
        'user-agent': 'bun-test-agent'
      })
    );
    fetchSessionMock.mockReset();
    fetchSessionMock.mockResolvedValue({
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        twoFactorEnabled: true,
        isAdmin: true
      },
      session: {
        id: 'session-1',
        userId: 'admin-1'
      }
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalApiInternalUrl === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = originalApiInternalUrl;
    }

    if (originalInternalApiSecret === undefined) {
      delete process.env.INTERNAL_API_SECRET;
    } else {
      process.env.INTERNAL_API_SECRET = originalInternalApiSecret;
    }
  });

  it('shows the disable 2FA actions for authorized admins when 2FA is enabled', async () => {
    const { default: SettingsPage } = await importFreshSettingsPage();

    const markup = renderToStaticMarkup(await SettingsPage());

    expect(markup).toContain('data-testid="backup-codes"');
    expect(markup).toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="two-factor-setup"');
    expect(fetchSessionMock).toHaveBeenCalledTimes(1);
  });

  it('shows the 2FA setup flow when 2FA is disabled, regardless of admin status', async () => {
    fetchSessionMock.mockResolvedValue({
      user: {
        name: 'Admin User',
        email: 'admin@example.com',
        twoFactorEnabled: false,
        isAdmin: true
      },
      session: {
        id: 'session-1',
        userId: 'admin-1'
      }
    });

    const { default: SettingsPage } = await importFreshSettingsPage();

    const markup = renderToStaticMarkup(await SettingsPage());

    expect(markup).toContain('data-testid="two-factor-setup"');
    expect(markup).not.toContain('data-testid="disable-two-factor"');
    expect(markup).not.toContain('data-testid="backup-codes"');
    expect(fetchSessionMock).toHaveBeenCalledTimes(1);
  });
});
