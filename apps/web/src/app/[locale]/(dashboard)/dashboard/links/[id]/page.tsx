// src/app/(dashboard)/links/[id]/page.tsx
'use client';

import { ArrowLeft, Edit, ExternalLink, Trash } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AnalyticsDashboardSkeleton } from '@/components/charts/analytics-skeleton';
import { ClicksChart } from '@/components/charts/clicks-chart';
import { CountriesChart } from '@/components/charts/countries-chart';
import { DevicesChart } from '@/components/charts/devices-chart';
import { ReferrersChart } from '@/components/charts/referrers-chart';
import { ErrorBoundary } from '@/components/error-boundary';
import { QueryError } from '@/components/query-error';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CopyButton } from '@/components/shared/copy-button';
import { QRCodeButton } from '@/components/shared/qr-code-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Link, useRouter } from '@/i18n/routing';
import { useLinkAnalytics } from '@/lib/hooks/use-analytics';
import { useDeleteLinkFlow } from '@/lib/hooks/use-delete-link-flow';
import { useLink } from '@/lib/hooks/use-links';

export default function LinkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;
  const t = useTranslations('Dashboard.linkDetail');
  const locale = useLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  const { data: link, isLoading, isError, error, refetch } = useLink(linkId);
  const { daily, breakdown, summary } = useLinkAnalytics(linkId);
  const { isDialogOpen, cancelDelete, confirmDelete, startDelete, isPending } =
    useDeleteLinkFlow({
      onSuccess: () => router.push('/dashboard/links?deleted=true')
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AnalyticsDashboardSkeleton />
      </div>
    );
  }

  if (isError || !link) {
    return (
      <QueryError
        error={error as Error}
        onRetry={() => refetch()}
        title={t('loadError')}
      />
    );
  }

  return (
    <ErrorBoundary>
      <ConfirmDialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && cancelDelete()}
        title={t('deleteConfirm')}
        description={t('deleteConfirm')}
        onConfirm={confirmDelete}
        confirmText={t('delete')}
        loading={isPending}
      />
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/links" aria-label={t('backAriaLabel')}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {t('shortLink')}
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {t('title')}
              </h2>
              <p className="truncate font-mono text-sm text-muted-foreground">
                {link.shortCode}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 pl-11 sm:pl-0 sm:flex-row sm:flex-wrap lg:justify-end">
            <QRCodeButton shortCode={link.shortCode} />
            <Button variant="outline" asChild>
              <Link href={`/dashboard/links/${linkId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                {t('edit')}
              </Link>
            </Button>
            <Button variant="destructive" onClick={() => startDelete(linkId)}>
              <Trash className="mr-2 h-4 w-4" />
              {t('delete')}
            </Button>
          </div>
        </div>

        <Card className="border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle>{t('linkInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('shortLink')}
                    </div>
                    <code className="block break-all font-mono text-sm text-foreground">
                      {link.shortUrl}
                    </code>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={link.shortUrl} />
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={link.shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('openNewTab')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t('openNewTab')}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('originalUrl')}
                    </div>
                    <code className="block break-all font-mono text-sm text-foreground">
                      {link.originalUrl}
                    </code>
                    <CopyButton text={link.originalUrl} />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('status')}
                  </div>
                  <div className="mt-2">
                    <Badge variant={link.isActive ? 'default' : 'secondary'}>
                      {link.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </div>

                {link.expiresAt && (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('expiresAt')}
                    </div>
                    <div className="mt-2 text-sm">
                      {new Date(link.expiresAt).toLocaleDateString(intlLocale)}
                    </div>
                  </div>
                )}

                {link.maxClicks && (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('clickLimit')}
                    </div>
                    <div className="mt-2 text-sm">
                      {link.clicksCount} / {link.maxClicks}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {summary.data && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/60 bg-card/85">
              <CardHeader className="pb-2">
                <CardDescription>{t('totalClicks')}</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.totalClicks}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-card/85">
              <CardHeader className="pb-2">
                <CardDescription>{t('uniqueVisitors')}</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.uniqueVisitors}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-card/85">
              <CardHeader className="pb-2">
                <CardDescription>{t('conversionRate')}</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.totalClicks > 0
                    ? (
                        (summary.data.uniqueVisitors /
                          summary.data.totalClicks) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-card/85">
              <CardHeader className="pb-2">
                <CardDescription>{t('avgClicksPerDay')}</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.avgClicksPerDay}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <div className="space-y-6">
          {daily.data && (
            <Card className="border-border/60 bg-card/90">
              <CardHeader>
                <CardTitle>{t('clicksOverTime')}</CardTitle>
                <CardDescription>{t('last30Days')}</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                <ClicksChart data={daily.data} />
              </CardContent>
            </Card>
          )}

          {breakdown.data && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-border/60 bg-card/90">
                <CardHeader>
                  <CardTitle>{t('countries')}</CardTitle>
                  <CardDescription>{t('topCountriesByClicks')}</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                  <CountriesChart data={breakdown.data.countries} />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/90">
                <CardHeader>
                  <CardTitle>{t('devices')}</CardTitle>
                  <CardDescription>{t('deviceDistribution')}</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                  <DevicesChart data={breakdown.data.devices} />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/90 xl:col-span-2">
                <CardHeader>
                  <CardTitle>{t('trafficSources')}</CardTitle>
                  <CardDescription>{t('trafficSourcesDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                  <ReferrersChart data={breakdown.data.referrers} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
