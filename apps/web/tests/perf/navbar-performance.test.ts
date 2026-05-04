/**
 * Performance benchmark for Navbar and HeroActions components.
 *
 * Measure render work after the module graph is already loaded. Timing the
 * first dynamic import mostly captures Bun/Next transpilation overhead, which
 * is noisy in full-suite runs and not representative of component performance.
 */

import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import { performance } from 'node:perf_hooks';
import { cleanup, render } from '@testing-library/react';
import { type ComponentType, createElement } from 'react';

let Navbar: typeof import('@/components/layout/navbar')['Navbar'];
let HeroActions: typeof import('@/components/home/hero-actions')['HeroActions'];

mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      Navigation: {
        home: 'Home',
        features: 'Features',
        project: 'Project Notes',
        docs: 'API Docs',
        closeMenu: 'Close menu',
        menuTitle: 'Menu'
      },
      Common: {
        language: 'Language',
        login: 'Login',
        signup: 'Create account',
        dashboard: 'Dashboard'
      },
      Hero: {
        loading: 'Loading...',
        goToDashboard: 'Go to Dashboard',
        getStarted: 'Get started',
        signIn: 'Sign in'
      }
    };

    return (key: string) => messages[namespace]?.[key] || key;
  })
}));

mock.module('@/i18n/routing', () => ({
  routing: {
    locales: ['en', 'pt-br']
  },
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => {
    return createElement('a', { href, ...props }, children);
  },
  redirect: () => undefined,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/'
}));

mock.module('@/lib/session-provider', () => ({
  SESSION_QUERY_KEY: ['session'],
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthState: () => ({
    data: null,
    isPending: false,
    isAuthenticated: false,
    refetch: async () => {},
    error: null
  }),
  useSessionContext: () => ({
    data: null,
    isPending: false,
    error: null,
    refetch: async () => {},
    isAuthenticated: false
  })
}));

beforeAll(async () => {
  if (
    typeof window !== 'undefined' &&
    typeof window.getComputedStyle !== 'function'
  ) {
    window.getComputedStyle = (_element: Element) =>
      ({
        paddingLeft: '0px',
        paddingRight: '0px',
        overflowX: 'visible',
        overflowY: 'visible'
      }) as unknown as CSSStyleDeclaration;
  }

  ({ Navbar } = await import('@/components/layout/navbar'));
  ({ HeroActions } = await import('@/components/home/hero-actions'));
});

afterEach(() => {
  cleanup();
});

function measureRenderTime(Component: ComponentType) {
  const startTime = performance.now();
  const view = render(createElement(Component));
  const renderTime = performance.now() - startTime;

  return {
    renderTime,
    view
  };
}

describe('Component Performance', () => {
  it('Navbar renders within acceptable time', () => {
    const { renderTime, view } = measureRenderTime(Navbar);

    expect(renderTime).toBeLessThan(250);
    expect(view.container.firstChild).toBeDefined();
  });

  it('HeroActions renders within acceptable time', () => {
    const { renderTime, view } = measureRenderTime(HeroActions);

    expect(renderTime).toBeLessThan(100);
    expect(view.container.firstChild).toBeDefined();
  });
});
