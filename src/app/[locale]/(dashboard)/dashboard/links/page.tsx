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
import { useDeleteLink, useLinks } from '@/lib/hooks/use-links';

export default function LinksPage() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, isError, error, refetch } = useLinks({
    page,
    perPage: 20,
    search: deferredSearch || undefined
  });

  const deleteLink = useDeleteLink();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLink.mutateAsync(deleteTarget);
      toast.success(t('toasts.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete link:', error);
      toast.error(
        error instanceof Error ? error.message : t('toasts.deleteError')
      );
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('links.deleteConfirm')}
        description={t('links.deleteConfirm')}
        onConfirm={confirmDelete}
        confirmText={t('linkCard.delete')}
        loading={deleteLink.isPending}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t('links.title')}
          </h2>
          <p className="text-muted-foreground">{t('links.subtitle')}</p>
        </div>
        <Button asChild>
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
          onChange={(e) => setSearch(e.target.value)}
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
                <LinkCard key={link.id} link={link} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.meta && data.meta.lastPage > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('pagination.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pagination.pageOf', { page, total: data.meta.lastPage })}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.meta.hasMore}
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
