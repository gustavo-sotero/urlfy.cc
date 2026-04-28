import '../setup';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const verificationMessages = {
  en: {
    title: 'Verify your email address',
    description:
      'You can keep using urlfy.cc, but verifying your email confirms that you own this address and helps us deliver security and onboarding messages to the right inbox.',
    justSentTitle: 'Verification email sent',
    justSentDescription:
      'We sent a verification email to {email}. This is separate from your welcome email.',
    justSentHelp:
      'Check your inbox and spam folder. If nothing arrives in a few minutes, use the resend action below.',
    sending: 'Sending...',
    sent: 'Verification email sent',
    resend: 'Resend verification email',
    checkInbox:
      'Check your inbox and spam folder. If nothing arrives in a few minutes, you can resend it.',
    errorEmail: 'We could not determine which email address to verify.',
    errorResend: 'We could not resend the verification email. Please try again.'
  },
  'pt-br': {
    title: 'Verifique seu e-mail',
    description:
      'Você pode continuar usando o urlfy.cc, mas verificar seu e-mail confirma que este endereço é seu e ajuda a manter os avisos de segurança e onboarding chegando na caixa certa.',
    justSentTitle: 'E-mail de verificação enviado',
    justSentDescription:
      'Enviamos um e-mail de verificação para {email}. Ele é separado do seu e-mail de boas-vindas.',
    justSentHelp:
      'Verifique sua caixa de entrada e spam. Se nada chegar em alguns minutos, use a ação de reenvio abaixo.',
    sending: 'Enviando...',
    sent: 'E-mail de verificação enviado',
    resend: 'Reenviar e-mail de verificação',
    checkInbox:
      'Verifique sua caixa de entrada e spam. Se nada chegar em alguns minutos, você pode reenviar.',
    errorEmail:
      'Não foi possível identificar qual endereço de e-mail deve ser verificado.',
    errorResend:
      'Não foi possível reenviar o e-mail de verificação. Tente novamente.'
  }
} as const;

type SupportedLocale = keyof typeof verificationMessages;
type MessageKey = keyof (typeof verificationMessages)['en'];

let activeLocale: SupportedLocale = 'en';

const useSearchParamsMock = mock(() => new URLSearchParams());
const useSessionMock = mock(() => ({
  data: null as null | { user?: { email?: string } }
}));
const sendVerificationEmailMock = mock(async () => undefined);

function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values?.[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

mock.module('next/navigation', () => ({
  redirect: () => {},
  permanentRedirect: () => {},
  notFound: () => {},
  useParams: () => ({}),
  usePathname: () => '/en/dashboard',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: useSearchParamsMock
}));

mock.module('next-intl', () => ({
  useLocale: () => activeLocale,
  useTranslations: (namespace: string) => {
    if (namespace !== 'Dashboard.verification') {
      return (key: string) => key;
    }

    return (key: string, values?: Record<string, string | number>) => {
      const template =
        verificationMessages[activeLocale][key as MessageKey] ?? key;
      return interpolate(template, values);
    };
  }
}));

mock.module('@/lib/auth.client', () => ({
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => undefined,
  useSession: useSessionMock,
  getSession: async () => ({ data: null, error: null }),
  resetPassword: async () => ({}),
  requestPasswordReset: async () => ({}),
  changePassword: async () => ({}),
  verifyEmail: async () => ({}),
  twoFactor: {},
  authClient: {
    useSession: useSessionMock,
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: sendVerificationEmailMock
  },
  default: {
    useSession: useSessionMock,
    getSession: async () => ({ data: null, error: null }),
    sendVerificationEmail: sendVerificationEmailMock
  }
}));

async function renderVerificationWarning(email = 'server@example.com') {
  const { VerificationWarning } = await import(
    '@/components/dashboard/verification-warning'
  );

  return render(<VerificationWarning email={email} />);
}

describe('VerificationWarning', () => {
  beforeEach(() => {
    activeLocale = 'en';
    window.location.href = 'https://urlfy.cc/en/dashboard';
    useSearchParamsMock.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useSessionMock.mockReset();
    useSessionMock.mockReturnValue({ data: null });
    sendVerificationEmailMock.mockReset();
    sendVerificationEmailMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the post-signup confirmation alongside the persistent reminder', async () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('verificationEmail=sent')
    );

    const view = await renderVerificationWarning('signup@example.com');

    expect(view.getAllByRole('alert').length).toBe(2);
    expect(view.getByText(verificationMessages.en.justSentTitle)).toBeDefined();
    expect(view.getByText(verificationMessages.en.title)).toBeDefined();
    expect(
      view.getByText(
        interpolate(verificationMessages.en.justSentDescription, {
          email: 'signup@example.com'
        })
      )
    ).toBeDefined();
  });

  it('uses the server email fallback and localized callback URL when resending', async () => {
    activeLocale = 'pt-br';
    window.location.href = 'https://urlfy.cc/pt-br/dashboard';

    const view = await renderVerificationWarning('fallback@example.com');

    fireEvent.click(
      view.getByRole('button', {
        name: verificationMessages['pt-br'].resend
      })
    );

    await waitFor(() => {
      expect(sendVerificationEmailMock).toHaveBeenCalledWith({
        email: 'fallback@example.com',
        callbackURL: `${window.location.origin}/pt-br/email-verification?verified=1`
      });
    });

    expect(
      view.getByText(verificationMessages['pt-br'].checkInbox)
    ).toBeDefined();
  });

  it('prefers the hydrated session email when resending', async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          email: 'session@example.com'
        }
      }
    });

    const view = await renderVerificationWarning('server@example.com');

    fireEvent.click(
      view.getByRole('button', {
        name: verificationMessages.en.resend
      })
    );

    await waitFor(() => {
      expect(sendVerificationEmailMock).toHaveBeenCalledWith({
        email: 'session@example.com',
        callbackURL: `${window.location.origin}/en/email-verification?verified=1`
      });
    });
  });

  it('shows localized fallback copy when resend fails', async () => {
    sendVerificationEmailMock.mockRejectedValueOnce(
      new Error('transport down')
    );

    const view = await renderVerificationWarning('error@example.com');

    fireEvent.click(
      view.getByRole('button', {
        name: verificationMessages.en.resend
      })
    );

    expect(
      await view.findByText(verificationMessages.en.errorResend)
    ).toBeDefined();
  });
});
