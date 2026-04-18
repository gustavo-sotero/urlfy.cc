// src/app/(dashboard)/dashboard/page.tsx
'use client';

import {
  ArrowRight,
  Link as LinkIcon,
  MousePointer,
  TrendingUp
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { QueryError } from '@/components/query-error';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LinkCard } from '@/components/shared/link-card';
import { LinkListSkeleton } from '@/components/shared/link-card-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { useDeleteLinkFlow } from '@/lib/hooks/use-delete-link-flow';
import {
  useDashboardSummary,
  useLinks,
  useUserQuota
} from '@/lib/hooks/use-links';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const fmt = useFormatter();

  const {
    data: linksData,
    isLoading: linksLoading,
    isError,
    error,
    refetch
  } = useLinks({
    page: 1,
    perPage: 5
  });

  const { data: quotaData, isLoading: quotaLoading } = useUserQuota();
  const { data: summaryData, isLoading: summaryLoading } =
    useDashboardSummary();
  const { isDialogOpen, cancelDelete, confirmDelete, startDelete, isPending } =
    useDeleteLinkFlow({
      onSuccess: () => toast.success(t('toasts.deleteSuccess')),
      onError: () => toast.error(t('toasts.deleteError'))
    });

  // Stats from dedicated summary endpoint (accurate across all links)
  const totalLinks = summaryData?.totalLinks || 0;
  const totalClicks = summaryData?.totalClicks || 0;
  const activeLinks = summaryData?.activeLinks || 0;

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t('title')}
        </h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {linksLoading || quotaLoading || summaryLoading ? (
          <StatsCardSkeleton />
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('stats.totalLinks')}
                </CardTitle>
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fmt.number(totalLinks)}
                </div>
                {quotaData && (
                  <p className="text-xs text-muted-foreground">
                    {t('stats.usedOf', {
                      used: quotaData.used,
                      limit: quotaData.limit
                    })}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('stats.totalClicks')}
                </CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fmt.number(totalClicks)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('stats.activeLinks')}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fmt.number(activeLinks)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('stats.avgClicks')}
                </CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fmt.number(
                    totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('stats.perLink')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Links */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('links.recentLinks')}</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/links">
              {t('links.viewAll')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {linksLoading && (
            <LinkListSkeleton count={3} ariaLabel={tCommon('loadingLinks')} />
          )}

          {isError && (
            <QueryError
              error={error as Error}
              onRetry={() => refetch()}
              title={t('toasts.loadLinksError')}
            />
          )}

          {linksData &&
            (linksData.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">{t('empty.noLinks')}</p>
                <Button asChild>
                  <Link href="/dashboard/links/new">
                    {t('empty.createAction')}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {linksData.data?.map((link) => (
                  <LinkCard key={link.id} link={link} onDelete={startDelete} />
                ))}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
