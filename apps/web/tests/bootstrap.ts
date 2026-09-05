import { mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import React from 'react';

type WebTestEnvironmentOptions = {
  mockLogtape?: boolean;
};

type WebTestEnvironmentState = {
  configured: boolean;
  logtapeMocked: boolean;
};

type WebTestEnvironmentHost = typeof globalThis & {
  __urlfyWebTestEnvironment__?: WebTestEnvironmentState;
};

const requiredSecrets = [
  'JWT_SECRET',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET'
] as const;

function getWebTestEnvironmentState(): WebTestEnvironmentState {
  const host = globalThis as WebTestEnvironmentHost;

  host.__urlfyWebTestEnvironment__ ??= {
    configured: false,
    logtapeMocked: false
  };

  return host.__urlfyWebTestEnvironment__;
}

function loadEnvFile(envPath: string): void {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    }
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        level: 'warn',
        message: '.env.test file not found, using environment variables',
        timestamp: new Date().toISOString()
      })}\n`
    );
  }
}

function validateRequiredSecrets(): void {
  for (const secret of requiredSecrets) {
    const secretValue = process.env[secret];

    if (!secretValue) {
      throw new Error(
        `Missing required test secret: ${secret}\n` +
          'Please ensure .env.test exists with all required secrets.\n' +
          'Generate secrets with: openssl rand -base64 32'
      );
    }

    if (secretValue.length < 32) {
      throw new Error(
        `Test secret ${secret} must be at least 32 characters long.\n` +
          'Current length: ' +
          secretValue.length +
          '\n' +
          'Generate a secure secret with: openssl rand -base64 32'
      );
    }
  }
}

function mockLogtapeModules(): void {
  mock.module('@logtape/logtape', () => ({
    getLogger: () => ({
      debug: () => {},
      info: () => {},
      warning: () => {},
      error: () => {},
      fatal: () => {},
      trace: () => {}
    }),
    configure: async () => {},
    reset: async () => {},
    getConsoleSink: () => () => {},
    // @logtape/elysia >= 2.3 imports this for request-scoped log context.
    withContext: <T>(_context: Record<string, unknown>, callback: () => T): T =>
      callback()
  }));

  mock.module('@logtape/otel', () => ({
    getOpenTelemetrySink: () => () => {}
  }));

  mock.module('@logtape/redaction', () => ({
    redactByField: (_sink: unknown) => _sink,
    DEFAULT_REDACT_FIELDS: []
  }));

  mock.module('@logtape/drizzle-orm', () => ({
    getLogger: () => ({ logQuery: () => {} })
  }));
}

function installHappyDom(): void {
  const window = new Window();
  const document = window.document;

  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).window = window;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).document = document;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).navigator = window.navigator;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLElement = window.HTMLElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLInputElement = window.HTMLInputElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLButtonElement = window.HTMLButtonElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLFormElement = window.HTMLFormElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLAnchorElement = window.HTMLAnchorElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).HTMLDivElement = window.HTMLDivElement;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).DocumentFragment = window.DocumentFragment;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).Element = window.Element;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).Event = window.Event;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).CustomEvent = window.CustomEvent;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).localStorage = window.localStorage;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).sessionStorage = window.sessionStorage;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).getComputedStyle = window.getComputedStyle.bind(window);
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).MutationObserver = window.MutationObserver;
  // biome-ignore lint/suspicious/noExplicitAny: Happy-DOM types don't fully match browser types
  (globalThis as any).NodeFilter = window.NodeFilter;
  // biome-ignore lint/suspicious/noExplicitAny: stub for Radix UI in tests
  (globalThis as any).IntersectionObserver =
    // biome-ignore lint/suspicious/noExplicitAny: stub for Radix UI in tests
    (globalThis as any).IntersectionObserver ??
    class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  // biome-ignore lint/suspicious/noExplicitAny: stub for animation frames in tests
  (globalThis as any).requestAnimationFrame =
    // biome-ignore lint/suspicious/noExplicitAny: stub for animation frames in tests
    (globalThis as any).requestAnimationFrame ??
    ((cb: FrameRequestCallback) => setTimeout(cb, 0));

  // biome-ignore lint/suspicious/noExplicitAny: stub for animation frames in tests
  (globalThis as any).cancelAnimationFrame =
    // biome-ignore lint/suspicious/noExplicitAny: stub for animation frames in tests
    (globalThis as any).cancelAnimationFrame ??
    ((id: number) => clearTimeout(id));

  if (typeof globalThis.ResizeObserver === 'undefined') {
    // biome-ignore lint/suspicious/noExplicitAny: ResizeObserver stub for tests
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: patching happy-dom window at test bootstrap
  (window as any).SyntaxError = SyntaxError;
  // biome-ignore lint/suspicious/noExplicitAny: patching happy-dom window at test bootstrap
  (window as any).TypeError = TypeError;
  // biome-ignore lint/suspicious/noExplicitAny: patching happy-dom window at test bootstrap
  (window as any).RangeError = RangeError;
}

function mockNextImageModule(): void {
  mock.module('next/image', () => ({
    default: function MockNextImage({
      src,
      alt,
      width,
      height,
      className,
      quality: _quality,
      ...rest
    }: {
      src: string | { src: string };
      alt: string;
      width?: number;
      height?: number;
      className?: string;
      quality?: number;
      [key: string]: unknown;
    }) {
      const resolvedSrc =
        typeof src === 'object' && src !== null ? src.src : src;
      return React.createElement('img', {
        src: resolvedSrc,
        alt,
        width,
        height,
        className,
        ...rest
      });
    }
  }));
}

export function configureWebTestEnvironment(
  options: WebTestEnvironmentOptions = {}
): void {
  const state = getWebTestEnvironmentState();

  if (state.configured) {
    if (options.mockLogtape && !state.logtapeMocked) {
      mockLogtapeModules();
      state.logtapeMocked = true;
    }

    return;
  }

  loadEnvFile(resolve(__dirname, '../../../.env.test'));
  validateRequiredSecrets();
  // Next.js augments NODE_ENV as readonly; tests intentionally mutate it.
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

  if (options.mockLogtape) {
    mockLogtapeModules();
    state.logtapeMocked = true;
  }

  process.stdout.write(
    `${JSON.stringify({
      level: 'info',
      message: 'Web test environment configured',
      timestamp: new Date().toISOString()
    })}\n`
  );

  installHappyDom();
  mockNextImageModule();
  state.configured = true;
}
