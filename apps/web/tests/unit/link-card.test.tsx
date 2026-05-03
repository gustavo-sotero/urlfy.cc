import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { LinkResponse } from '@/types/links.types';

mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'Dashboard.linkCard': {
        passwordProtected: 'Password protected',
        options: 'Options',
        viewAnalytics: 'View analytics',
        edit: 'Edit',
        open: 'Open',
        delete: 'Delete',
        restore: 'Restore',
        deleted: 'Deleted',
        inactive: 'Inactive',
        expired: 'Expired',
        limitReached: 'Limit reached',
        clicks: 'clicks',
        expiresIn: 'Expires {date}',
        limit: 'Limit {max}'
      },
      Common: {
        copy: 'Copy',
        copied: 'Copied'
      }
    };

    return (key: string, values?: Record<string, string | number>) => {
      const template = messages[namespace]?.[key] || key;
      return Object.entries(values ?? {}).reduce(
        (message, [token, value]) =>
          message.replace(`{${token}}`, String(value)),
        template
      );
    };
  })
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
  redirect: () => undefined,
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/dashboard/links'
}));

mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuShortcut: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    asChild,
    className
  }: {
    children: ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    className?: string;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    ),
  DropdownMenuCheckboxItem: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuPortal: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuSub: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  )
}));

describe('LinkCard', () => {
  afterEach(() => {
    cleanup();
  });

  const baseLink: LinkResponse = {
    id: 'link-1',
    shortCode: 'demo123',
    shortUrl: 'https://urlfy.cc/demo123',
    originalUrl: 'https://example.com/very/long/path',
    redirectType: 302,
    clicksCount: 24,
    maxClicks: 24,
    isActive: false,
    isBanned: false,
    bannedReason: null,
    isProtected: true,
    expiresAt: '2024-01-01T00:00:00.000Z',
    metaTitle: null,
    metaDescription: null,
    metaImage: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    tags: ['launch', 'paid'],
    notes: null,
    lastClickedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  async function renderCard(link: LinkResponse, onDelete = mock(() => {})) {
    const { LinkCard } = await import('@/components/shared/link-card');
    render(<LinkCard link={link} onDelete={onDelete} />);
    return onDelete;
  }

  it('renders protected, inactive, expired and limit metadata for dense mobile cards', async () => {
    await renderCard(baseLink);

    expect(screen.getByText('https://urlfy.cc/demo123')).toBeDefined();
    expect(
      screen.getByText('https://example.com/very/long/path')
    ).toBeDefined();
    expect(screen.getByText('Password protected')).toBeDefined();
    expect(screen.getByText('Inactive')).toBeDefined();
    expect(screen.getByText('Expired')).toBeDefined();
    expect(screen.getByText('Limit reached')).toBeDefined();
    expect(screen.getByText('launch')).toBeDefined();
    expect(screen.getByText('paid')).toBeDefined();
    expect(screen.getByText('24 clicks')).toBeDefined();
    expect(screen.getByText('Limit 24')).toBeDefined();
  });

  it('keeps analytics and edit routes accessible from the action menu and forwards delete', async () => {
    const onDelete = mock(() => {});
    await renderCard(
      {
        ...baseLink,
        maxClicks: null,
        expiresAt: null,
        clicksCount: 12,
        isActive: true,
        isProtected: false,
        tags: null
      },
      onDelete
    );

    expect(
      screen.getByRole('link', { name: /view analytics/i }).getAttribute('href')
    ).toBe('/dashboard/links/link-1');
    expect(
      screen.getByRole('link', { name: /edit/i }).getAttribute('href')
    ).toBe('/dashboard/links/link-1/edit');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('link-1');
  });

  it('switches the action menu to restore mode for deleted-link views', async () => {
    const onRestore = mock(() => {});
    const { LinkCard } = await import('@/components/shared/link-card');

    render(
      <LinkCard
        link={baseLink}
        onDelete={mock(() => {})}
        mode="deleted"
        onRestore={onRestore}
      />
    );

    expect(screen.getByText('Deleted')).toBeDefined();
    expect(screen.queryByRole('link', { name: /view analytics/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith('link-1');
  });
});
