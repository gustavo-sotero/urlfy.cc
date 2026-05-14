import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import { LinkForm } from '@/components/forms/link-form';
import { ApiClientError } from '@/lib/api/error';

const createLinkMock = mock(async ({ url }: { url: string }) => ({
  id: 'link-1',
  shortCode: 'demo123',
  shortUrl: 'https://urlfy.cc/demo123',
  originalUrl: url,
  redirectType: 302 as const,
  clicksCount: 0,
  maxClicks: null,
  isActive: true,
  isBanned: false,
  bannedReason: null,
  isProtected: false,
  expiresAt: null,
  metaTitle: null,
  metaDescription: null,
  metaImage: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  tags: null,
  notes: null,
  lastClickedAt: null,
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z'
}));
const reportActionErrorMock = mock(() => {});
let createLinkState = {
  isPending: false,
  mutateAsync: createLinkMock
};

mock.module('next-intl', () => ({
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'LinkForm.guest': {
        label: 'Enter your URL',
        placeholder: 'Paste your URL here...',
        shorten: 'Shorten',
        creating: 'Creating...',
        successMessage: 'Link created successfully!',
        createAnother: 'Create another link',
        shortUrlLabel: 'Your shortened URL',
        invalidUrl: 'Invalid URL',
        urlBlockedShortener:
          'URL shortener services cannot be shortened again. Please use the original URL.',
        urlTooLong: 'URL is too long (max 2048 characters).',
        urlBlocked: 'This URL has been blocked and cannot be shortened.',
        rateLimited: 'Too many requests. Please try again in a moment.',
        serverError: 'Something went wrong. Please try again.'
      },
      Common: {
        copy: 'Copy',
        copied: 'Copied'
      }
    };

    return (key: string) => messages[namespace]?.[key] || key;
  })
}));

mock.module('@/lib/hooks/use-links', () => ({
  useCreateLink: () => createLinkState
}));

mock.module('@/lib/browser-logger', () => ({
  reportActionError: reportActionErrorMock
}));

describe('LinkForm', () => {
  afterEach(() => {
    cleanup();
    createLinkMock.mockClear();
    reportActionErrorMock.mockClear();
    createLinkState = {
      isPending: false,
      mutateAsync: createLinkMock
    };
  });

  it('uses a full-width submit button before the small breakpoint', () => {
    render(<LinkForm />);

    const submitButton = screen.getByRole('button', { name: /shorten/i });

    expect(submitButton.className).toContain('w-full');
    expect(submitButton.className).toContain('sm:w-auto');
  });

  it('stacks the success state actions before the small breakpoint', async () => {
    render(<LinkForm />);

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'https://example.com/mobile-success-state' }
      });
    });

    await act(async () => {
      fireEvent.submit(
        screen
          .getByRole('button', { name: /shorten/i })
          .closest('form') as HTMLFormElement
      );
    });

    expect(createLinkMock).toHaveBeenCalledWith({
      url: 'https://example.com/mobile-success-state'
    });

    const shortUrlInput = screen.getByTestId('short-url');
    const successLayout = shortUrlInput.parentElement;
    const resetButton = screen.getByRole('button', {
      name: /create another/i
    });

    expect(successLayout?.className).toContain('grid');
    expect(successLayout?.className).toContain(
      'sm:grid-cols-[minmax(0,1fr)_auto]'
    );
    expect(resetButton.className).toContain('w-full');
    expect(resetButton.className).toContain('sm:w-auto');

    await act(async () => {
      fireEvent.click(resetButton);
    });

    expect(screen.getByRole('button', { name: /shorten/i })).toBeDefined();
  });
});
it('reports create-link failures without leaving the guest form', async () => {
  const failingCreateLinkMock = mock(async () => {
    throw new Error('create failed');
  });

  createLinkState = {
    isPending: false,
    mutateAsync: failingCreateLinkMock
  };

  render(<LinkForm />);

  await act(async () => {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.com/failure' }
    });
  });

  await act(async () => {
    fireEvent.submit(
      screen
        .getByRole('button', { name: /shorten/i })
        .closest('form') as HTMLFormElement
    );
  });

  expect(reportActionErrorMock).toHaveBeenCalledWith(expect.any(Error), {
    action: 'create-link'
  });
  expect(screen.getByRole('button', { name: /shorten/i })).toBeDefined();

  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain('Something went wrong');
});

it('shows a specific message for known ApiClientError codes', async () => {
  const apiError = new ApiClientError(
    'SHORTENER_NOT_ALLOWED',
    'Shortening other URL shorteners is not allowed'
  );
  const failingMock = mock(async () => {
    throw apiError;
  });
  createLinkState = { isPending: false, mutateAsync: failingMock };

  render(<LinkForm />);

  await act(async () => {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://bit.ly/example' }
    });
  });

  await act(async () => {
    fireEvent.submit(
      screen
        .getByRole('button', { name: /shorten/i })
        .closest('form') as HTMLFormElement
    );
  });

  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain(
    'URL shortener services cannot be shortened again'
  );
});

it('falls back to serverError message for unknown ApiClientError codes', async () => {
  const apiError = new ApiClientError('SOME_UNKNOWN_CODE', 'Internal failure');
  const failingMock = mock(async () => {
    throw apiError;
  });
  createLinkState = { isPending: false, mutateAsync: failingMock };

  render(<LinkForm />);

  await act(async () => {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.com/unknown-error' }
    });
  });

  await act(async () => {
    fireEvent.submit(
      screen
        .getByRole('button', { name: /shorten/i })
        .closest('form') as HTMLFormElement
    );
  });

  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain('Something went wrong');
});
