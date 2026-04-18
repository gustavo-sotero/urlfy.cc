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
    <div className="space-y-6 md:space-y-8">
      <ConfirmDialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && cancelDelete()}
        title={t('links.deleteConfirm')}
        description={t('links.deleteConfirm')}
        onConfirm={confirmDelete}
        confirmText={t('linkCard.delete')}
        loading={isPending}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('links.title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            {t('links.subtitle')}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto xl:self-auto">
          <Link href="/dashboard/links/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('links.newLink')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative xl:max-w-xl xl:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className="h-11 rounded-xl border-border/60 bg-background/80 pl-10"
          />
        </div>

        {data?.meta && (hasPrevious || hasNext) ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between xl:shrink-0">
            <span className="text-sm text-muted-foreground">
              {t('pagination.pageOf', { page, total: data.meta.lastPage })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={!hasPrevious}
                className="flex-1 sm:flex-none"
              >
                {t('pagination.previous')}
              </Button>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!hasNext}
                className="flex-1 sm:flex-none"
              >
                {t('pagination.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading && (
        <LinkListSkeleton count={5} ariaLabel={tCommon('loadingLinks')} />
      )}

      {isError && (
        <QueryError error={error as Error} onRetry={() => refetch()} />
      )}

      {data?.data ? (
        data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 p-8 text-center sm:p-12">
            <p className="text-muted-foreground">
              {search ? t('empty.noSearch') : t('empty.noLinks')}
            </p>
            {!search && (
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/links/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('empty.createAction')}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {data.data.map((link) => (
              <LinkCard key={link.id} link={link} onDelete={startDelete} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
