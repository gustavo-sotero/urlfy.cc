import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';

type Locale = 'en' | 'pt-br';

let currentLocale: Locale = 'en';

mock.module('next-intl', () => ({
  useLocale: () => currentLocale,
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Common: {
        language: currentLocale === 'pt-br' ? 'Idioma' : 'Language'
      }
    };

    return (key: string) => messages[namespace]?.[key] ?? key;
  }
}));

mock.module('@/i18n/routing', () => ({
  routing: {
    locales: ['en', 'pt-br']
  },
  usePathname: () =>
    currentLocale === 'pt-br' ? '/pt-br/project' : '/en/project',
  useRouter: () => ({
    replace: () => undefined
  })
}));

describe('LanguageSwitcher', () => {
  afterEach(() => {
    cleanup();
    currentLocale = 'en';
  });

  it('renders a localized compact trigger label', () => {
    render(<LanguageSwitcher />);

    expect(
      screen.getByRole('button', { name: 'Language: English' })
    ).toBeDefined();
  });

  it('renders localized inline labels for the locale buttons', () => {
    currentLocale = 'pt-br';

    render(<LanguageSwitcher variant="inline" />);

    expect(screen.getByRole('group', { name: 'Idioma' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Idioma: Português' })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Idioma: English' })
    ).toBeDefined();
  });
});
