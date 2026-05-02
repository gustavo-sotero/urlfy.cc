import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import type { ReactNode } from 'react';
import type { LinkResponse } from '@/types/links.types';

const createMutateAsyncMock = mock(async () => ({ id: 'created-link-id' }));
const updateMutateAsyncMock = mock(async () => ({}));
const refetchMock = mock(async () => {});
let paramsValue = { id: 'link-1' };
let createLinkState = {
  isPending: false,
  mutateAsync: createMutateAsyncMock
};
let updateLinkState = {
  isPending: false,
  mutateAsync: updateMutateAsyncMock
};
let currentLink: LinkResponse | undefined;

function translate(
  namespace: string,
  key: string,
  values?: Record<string, string | number>
) {
  const messages: Record<string, Record<string, string>> = {
    LinkForm: {
      titleNew: 'Create link',
      subtitleNew: 'Create and configure a short link.',
      titleEdit: 'Edit link',
      'sections.basic': 'Basic settings',
      'sections.basicDesc': 'Only the core fields for a quick link.',
      'sections.advanced': 'Advanced settings',
      'sections.advancedDesc': 'Expiration, limits and protection controls.',
      'sections.meta': 'Meta tags',
      'sections.metaDesc': 'Override how the link appears on social previews.',
      'sections.tracking': 'Tracking',
      'sections.trackingDesc': 'Attach campaign metadata when needed.',
      'sections.limits': 'Operational settings',
      'sections.limitsDesc':
        'Keep the live settings aligned with the campaign.',
      'summary.title': 'Link summary',
      'summary.descriptionNew': 'Live preview of the link you are building.',
      'summary.descriptionEdit': 'Review the current settings before saving.',
      'summary.autoAlias': 'Auto alias',
      'summary.noDestination': 'No destination',
      'summary.destination': 'Destination',
      'summary.shortCode': 'Short code',
      'summary.redirect': 'Redirect',
      'summary.limits': 'Limits',
      'summary.none': 'None',
      'summary.security': 'Security',
      'summary.passwordEnabled': 'Password enabled',
      'summary.passwordPill': 'Password',
      'summary.limitsPill': 'Limits',
      'summary.metadataPill': 'Metadata',
      'summary.trackingPill': 'Tracking',
      'summary.notesPill': 'Notes',
      'summary.statusCreating': 'Creating',
      'summary.statusSaving': 'Saving',
      'summary.statusValidating': 'Validating',
      'summary.statusReady': 'Ready',
      'summary.statusNeedsReview': 'Needs review',
      'summary.maxClicksValue': '{count} clicks max',
      'summary.expiresOnValue': 'Expires {date}',
      'summary.shortLink': 'Short link',
      'summary.linkStatus': 'Link status',
      'summary.activeValue': 'Active',
      'summary.inactiveValue': 'Inactive',
      'summary.currentClicks': 'Current clicks',
      'fields.url.label': 'Destination URL',
      'fields.url.hint': 'Paste the full destination.',
      'fields.url.placeholder': 'https://example.com/article',
      'fields.alias.label': 'Custom alias',
      'fields.alias.hint': 'Optional branded slug.',
      'fields.alias.placeholder': 'spring-campaign',
      'fields.redirectType.label': 'Redirect type',
      'fields.redirectType.hint':
        'Choose between temporary and permanent redirects.',
      'fields.expiresAt.label': 'Expiration',
      'fields.expiresAt.hint': 'Optional auto-expiration.',
      'fields.maxClicks.label': 'Max clicks',
      'fields.maxClicks.hint': 'Optional click cap.',
      'fields.password.label': 'Password',
      'fields.password.hint': 'Protect the link with a password if needed.',
      'fields.password.placeholder': 'Optional password',
      'fields.metaTitle.label': 'Meta title',
      'fields.metaTitle.hint': 'Shown on social previews.',
      'fields.metaDescription.label': 'Meta description',
      'fields.metaDescription.hint': 'Short preview description.',
      'fields.metaImage.label': 'Meta image',
      'fields.metaImage.hint': 'Public image URL for previews.',
      'fields.notes.label': 'Notes',
      'fields.notes.hint': 'Internal campaign notes.',
      'fields.isActive.label': 'Active',
      'fields.isActive.hint': 'Pause redirects without deleting the link.',
      'actions.cancel': 'Cancel',
      'actions.create': 'Create link',
      'actions.save': 'Save changes',
      'actions.backToList': 'Back to links',
      'actions.backToDetails': 'Back to details',
      permanent: 'Permanent',
      temporary: 'Temporary',
      metaTitle: 'Meta title',
      metaDescription: 'Meta description',
      metaImagePlaceholder: 'https://example.com/image.png',
      utmSource: 'UTM source',
      utmMedium: 'UTM medium',
      utmCampaign: 'UTM campaign',
      notesPlaceholder: 'Internal notes',
      'hints.currentClicks': 'Current clicks: {count}',
      'errors.loadFailed': 'Failed to load link',
      'validation.invalidUrl': 'Enter a valid URL',
      'validation.invalidAlias': 'Invalid alias',
      'validation.positiveNumber': 'Use a positive number',
      'validation.maxLength60': 'Max 60 characters',
      'validation.maxLength160': 'Max 160 characters',
      'validation.invalidImage': 'Enter a valid image URL'
    }
  };

  const template = messages[namespace]?.[key] || key;

  return Object.entries(values ?? {}).reduce(
    (message, [token, value]) => message.replace(`{${token}}`, String(value)),
    template
  );
}

mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, string | number>) =>
      translate(namespace, key, values)
}));

mock.module('next/navigation', () => ({
  redirect: () => {},
  permanentRedirect: () => {},
  notFound: () => {},
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/links/link-1/edit',
  useRouter: () => ({ push: () => {} }),
  useParams: () => paramsValue
}));

mock.module('@/i18n/routing', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: () => {}
  })
}));

mock.module('@/lib/browser-logger', () => ({
  reportActionError: () => {}
}));

mock.module('@/lib/hooks/use-links', () => ({
  useCreateLink: () => createLinkState,
  useUpdateLink: () => updateLinkState,
  useLink: () => ({
    data: currentLink,
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock
  })
}));

describe('Dashboard link forms', () => {
  afterEach(() => {
    cleanup();
    createMutateAsyncMock.mockClear();
    updateMutateAsyncMock.mockClear();
    refetchMock.mockClear();
    paramsValue = { id: 'link-1' };
    createLinkState = {
      isPending: false,
      mutateAsync: createMutateAsyncMock
    };
    updateLinkState = {
      isPending: false,
      mutateAsync: updateMutateAsyncMock
    };
    currentLink = undefined;
  });

  it('keeps advanced create fields collapsed by default and updates the live summary', async () => {
    const { default: NewLinkPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/links/new/page'
    );

    await act(async () => {
      render(<NewLinkPage />);
    });

    expect(document.querySelector('input#expiresAt')).toBeNull();

    await act(async () => {
      fireEvent.change(
        document.querySelector('input#url') as HTMLInputElement,
        {
          target: { value: 'https://example.com/articles/mobile-dashboard' }
        }
      );
      fireEvent.change(
        document.querySelector('input#customAlias') as HTMLInputElement,
        {
          target: { value: 'spring-launch' }
        }
      );
    });

    expect(screen.getByText('example.com')).toBeDefined();
    expect(screen.getByText('spring-launch')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /advanced settings/i })
    ).toBeDefined();
  });

  it('submits the create form with a cleaned payload and redirects to the new link banner state', async () => {
    const { default: NewLinkPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/links/new/page'
    );

    let view: ReturnType<typeof render>;

    await act(async () => {
      view = render(<NewLinkPage />);
    });

    await act(async () => {
      fireEvent.change(
        document.querySelector('input#url') as HTMLInputElement,
        {
          target: { value: 'https://example.com/offers' }
        }
      );
    });

    await act(async () => {
      fireEvent.submit(
        (view as ReturnType<typeof render>).container.querySelector(
          'form'
        ) as HTMLFormElement
      );
    });

    expect(createMutateAsyncMock).toHaveBeenCalledWith({
      url: 'https://example.com/offers',
      redirectType: 302
    });
  });

  it('rejects invalid aliases on the client before hitting the API', async () => {
    const { default: NewLinkPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/links/new/page'
    );

    let view: ReturnType<typeof render>;

    await act(async () => {
      view = render(<NewLinkPage />);
    });

    await act(async () => {
      fireEvent.change(
        document.querySelector('input#url') as HTMLInputElement,
        {
          target: { value: 'https://example.com/offers' }
        }
      );
      fireEvent.change(
        document.querySelector('input#customAlias') as HTMLInputElement,
        {
          target: { value: 'bad_alias' }
        }
      );
    });

    await act(async () => {
      fireEvent.submit(
        (view as ReturnType<typeof render>).container.querySelector(
          'form'
        ) as HTMLFormElement
      );
    });

    expect(createMutateAsyncMock).not.toHaveBeenCalled();
    expect(await screen.findByText('Invalid alias')).toBeDefined();
  });

  it('renders edit data and submits operational changes back to the detail page', async () => {
    currentLink = {
      id: 'link-1',
      shortCode: 'spring-launch',
      shortUrl: 'https://urlfy.cc/spring-launch',
      originalUrl: 'https://example.com/spring',
      redirectType: 302,
      clicksCount: 12,
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
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z'
    };

    const { default: EditLinkPage } = await import(
      '@/app/[locale]/(dashboard)/dashboard/links/[id]/edit/page'
    );

    let view: ReturnType<typeof render>;

    await act(async () => {
      view = render(<EditLinkPage />);
    });

    expect(
      screen.getAllByText('https://urlfy.cc/spring-launch').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.submit(
        (view as ReturnType<typeof render>).container.querySelector(
          'form'
        ) as HTMLFormElement
      );
    });

    expect(updateMutateAsyncMock).toHaveBeenCalledWith({
      id: 'link-1',
      data: {
        isActive: true
      }
    });
  });
});
