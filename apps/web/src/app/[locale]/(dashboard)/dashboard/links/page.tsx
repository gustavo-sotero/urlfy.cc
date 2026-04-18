// src/app/(dashboard)/links/page.tsx
'use client';

import { Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { QueryError } from '@/components/query-error';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LinkCard } from '@/components/shared/link-card';
import { LinkListSkeleton } from '@/components/shared/link-card-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { useDeleteLinkFlow } from '@/lib/hooks/use-delete-link-flow';
import { useLinks } from '@/lib/hooks/use-links';

export default function LinksPage() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);
  const page = cursorHistory.length + 1;

  const { data, isLoading, isError, error, refetch } = useLinks({
    cursor,
    perPage: 20,
    search: deferredSearch || undefined
  });

  const hasPrevious = cursorHistory.length > 0;
  const hasNext = !!data?.meta?.nextCursor;

  function handlePreviousPage() {
    if (!hasPrevious) return;

    const history = [...cursorHistory];
    const previousCursor = history.pop();
    setCursor(previousCursor || undefined);
    setCursorHistory(history);
  }

  function handleNextPage() {
    const nextCursor = data?.meta?.nextCursor;
    if (!nextCursor) return;

    setCursorHistory((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
  }

  const { isDialogOpen, cancelDelete, confirmDelete, startDelete, isPending } =
    useDeleteLinkFlow({
      onSuccess: () => toast.success(t('toasts.deleteSuccess')),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : t('toasts.deleteError')
        )
    });

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && cancelDelete()}
        title={t('links.deleteConfirm')}
        description={t('links.deleteConfirm')}
        onConfirm={confirmDelete}
        confirmText={t('linkCard.delete')}
        loading={isPending}
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('links.title')}
          </h2>
          <p className="text-muted-foreground">{t('links.subtitle')}</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/dashboard/links/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('links.newLink')}
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(undefined);
            setCursorHistory([]);
          }}
          className="pl-10"
        />
      </div>

      {/* Links List */}
      {isLoading && (
        <LinkListSkeleton count={5} ariaLabel={tCommon('loadingLinks')} />
      )}

      {isError && (
        <QueryError error={error as Error} onRetry={() => refetch()} />
      )}

      {data?.data && (
        <>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">
                {search ? t('empty.noSearch') : t('empty.noLinks')}
              </p>
              {!search && (
                <Button asChild>
                  <Link href="/dashboard/links/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.createAction')}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {data.data.map((link) => (
                <LinkCard key={link.id} link={link} onDelete={startDelete} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.meta && (hasPrevious || hasNext) && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={!hasPrevious}
              >
                {t('pagination.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pagination.pageOf', { page, total: data.meta.lastPage })}
              </span>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!hasNext}
              >
                {t('pagination.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
