/**
 * Unit tests for ConsentBanner component
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock
} from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ConsentBanner } from '@/components/consent-banner';

// Mock next-intl
mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Consent: {
        title: 'Privacidade e Cookies',
        description: 'Usamos cookies para melhorar sua experiência.',
        privacyPolicy: 'Política de Privacidade',
        essential: 'Cookies essenciais (obrigatório)',
        essentialHint: 'Necessário para o funcionamento do site',
        analytics: 'Analytics',
        marketing: 'Marketing',
        acceptAll: 'Aceitar todos',
        rejectAll: 'Rejeitar tudo',
        savePreferences: 'Salvar preferências',
        saving: 'Salvando...',
        closeAriaLabel: 'Fechar banner de consentimento'
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
    href: string | { pathname: string };
    [key: string]: unknown;
  }) => {
    const resolvedHref =
      typeof href === 'string' ? href : (href as { pathname: string }).pathname;
    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    );
  }
}));

describe('ConsentBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.removeItem('consent_preferences');
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
    localStorage.removeItem('consent_preferences');
  });

  it('does not render when consent is already stored', () => {
    localStorage.setItem(
      'consent_preferences',
      JSON.stringify({
        analytics: true,
        marketing: true,
        timestamp: new Date().toISOString()
      })
    );

    render(<ConsentBanner />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is not visible immediately before the delay fires', () => {
    render(<ConsentBanner />);

    // Banner hidden until 500ms delay completes
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('becomes visible after the 500ms delay when consent is missing', async () => {
    render(<ConsentBanner />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Privacidade e Cookies')).toBeDefined();
  });

  it('shows all three action buttons after banner appears', async () => {
    render(<ConsentBanner />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByText('Aceitar todos')).toBeDefined();
    expect(screen.getByText('Rejeitar tudo')).toBeDefined();
    expect(screen.getByText('Salvar preferências')).toBeDefined();
  });

  it('action buttons have w-full class for mobile full-width layout', async () => {
    render(<ConsentBanner />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    const acceptButton = screen.getByText('Aceitar todos').closest('button');
    const rejectButton = screen.getByText('Rejeitar tudo').closest('button');
    const saveButton = screen
      .getByText('Salvar preferências')
      .closest('button');

    expect(acceptButton?.className).toContain('w-full');
    expect(rejectButton?.className).toContain('w-full');
    expect(saveButton?.className).toContain('w-full');
  });

  it('stores preferences and hides banner when accept all is clicked', async () => {
    render(<ConsentBanner />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    const acceptButton = screen.getByText('Aceitar todos');
    await act(async () => {
      acceptButton.click();
    });

    expect(screen.queryByRole('dialog')).toBeNull();

    const stored = JSON.parse(
      localStorage.getItem('consent_preferences') ?? '{}'
    );
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
  });

  it('stores preferences and hides banner when reject all is clicked', async () => {
    render(<ConsentBanner />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    const rejectButton = screen.getByText('Rejeitar tudo');
    await act(async () => {
      rejectButton.click();
    });

    expect(screen.queryByRole('dialog')).toBeNull();

    const stored = JSON.parse(
      localStorage.getItem('consent_preferences') ?? '{}'
    );
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
  });

  it('close button is accessible with correct aria-label', async () => {
    render(<ConsentBanner />);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    const closeButton = screen.getByLabelText('Fechar banner de consentimento');
    expect(closeButton).toBeDefined();
  });
});
