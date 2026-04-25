// src/app/(dashboard)/analytics/page.tsx
'use client';

import { BarChart2, MousePointer, TrendingUp, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  ChartSkeleton,
  StatsGridSkeleton
} from '@/components/charts/analytics-skeleton';
import { ClicksChart } from '@/components/charts/clicks-chart';
import { CountriesChart } from '@/components/charts/countries-chart';
import { DevicesChart } from '@/components/charts/devices-chart';
import { ReferrersChart } from '@/components/charts/referrers-chart';
import { QueryError } from '@/components/query-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  useAnalyticsBreakdown,
  useAnalyticsSummary,
  useDailyStats
} from '@/lib/hooks/use-analytics';
import { useLinks } from '@/lib/hooks/use-links';

export default function AnalyticsPage() {
  const t = useTranslations('Analytics');
  const fmt = useFormatter();
  const [selectedLinkId, setSelectedLinkId] = useState<string>('all');
  const [days, setDays] = useState('30');

  // Get user's links (dropdown selector only — no polling needed)
  const {
    data: linksData,
    isLoading: linksLoading,
    isError: linksError,
    error: linksErrorDetails,
    refetch: refetchLinks
  } = useLinks(
    {
      perPage: 100
    },
    { refetchInterval: false, staleTime: 60_000 }
  );

  // Fetch real analytics data
  const {
    data: dailyData,
    isLoading: dailyLoading,
    isError: dailyError,
    error: dailyErrorDetails,
    refetch: refetchDaily
  } = useDailyStats(
    selectedLinkId === 'all' ? 'all' : selectedLinkId,
    Number.parseInt(days, 10),
    {
      enabled: !linksLoading && !linksError
    }
  );

  const { data: summaryData, isLoading: summaryLoading } = useAnalyticsSummary(
    selectedLinkId === 'all' ? 'all' : selectedLinkId,
    {
      enabled: !linksLoading && !linksError
    }
  );

  const { data: breakdownData, isLoading: breakdownLoading } =
    useAnalyticsBreakdown(selectedLinkId === 'all' ? 'all' : selectedLinkId, {
      enabled: !linksLoading && !linksError
    });

  // Compute totals from daily data or use summary
  const totalClicks = useMemo(() => {
    if (summaryData?.totalClicks) return summaryData.totalClicks;
    if (!dailyData) return 0;
    return dailyData.reduce((acc, day) => acc + day.clicks, 0);
  }, [dailyData, summaryData]);

  const totalVisitors = useMemo(() => {
    if (summaryData?.uniqueVisitors) return summaryData.uniqueVisitors;
    if (!dailyData) return 0;
    return dailyData.reduce((acc, day) => acc + day.uniqueVisitors, 0);
  }, [dailyData, summaryData]);

  const isLoading = linksLoading || dailyLoading || summaryLoading;

  // Check for any errors
  if (linksError) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t('overviewDesc')}</p>
        </div>
        <QueryError
          error={linksErrorDetails as Error}
          onRetry={() => refetchLinks()}
          title={t('errors.loadLinks')}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t('overviewDesc')}</p>
        </div>
        <StatsGridSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (dailyError) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t('overviewDesc')}</p>
        </div>
        <QueryError
          error={dailyErrorDetails as Error}
          onRetry={() => refetchDaily()}
          title={t('errors.loadFailed')}
        />
      </div>
    );
  }

  // Prepare chart data with fallback to empty arrays
  const chartDailyData = dailyData || [];
  const chartCountriesData = breakdownData?.countries || [];
  const chartDevicesData = breakdownData?.devices || [];
  const chartReferrersData = breakdownData?.referrers || [];
  const links = linksData?.data || [];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {t('overview')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t('overviewDesc')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:w-120">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('filters.selectLink')}</p>
            <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
              <SelectTrigger className="w-full rounded-xl border-border/60 bg-background/80">
                <SelectValue placeholder={t('filters.allLinks')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allLinks')}</SelectItem>
                {links.map((link) => (
                  <SelectItem key={link.id} value={link.id}>
                    {link.shortCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('filters.selectPeriod')}</p>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-full rounded-xl border-border/60 bg-background/80">
                <SelectValue placeholder={t('filters.selectPeriod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('period.last7')}</SelectItem>
                <SelectItem value="30">{t('period.last30')}</SelectItem>
                <SelectItem value="90">{t('period.last90')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/85">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalClicks')}
            </CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt.number(totalClicks)}</div>
            <p className="text-xs text-muted-foreground">
              {summaryData?.totalClicksGrowth !== undefined ? (
                <span
                  className={`${
                    summaryData.totalClicksGrowth > 0
                      ? 'text-green-500'
                      : summaryData.totalClicksGrowth < 0
                        ? 'text-red-500'
                        : ''
                  }`}
                >
                  {summaryData.totalClicksGrowth > 0 ? '+' : ''}
                  {fmt.number(summaryData.totalClicksGrowth, {
                    style: 'percent',
                    minimumFractionDigits: 1
                  })}
                </span>
              ) : null}{' '}
              {t('growth.comparedToPreviousPeriod')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('uniqueVisitors')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fmt.number(totalVisitors)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summaryData?.uniqueVisitorsGrowth !== undefined ? (
                <span
                  className={`${
                    summaryData.uniqueVisitorsGrowth > 0
                      ? 'text-green-500'
                      : summaryData.uniqueVisitorsGrowth < 0
                        ? 'text-red-500'
                        : ''
                  }`}
                >
                  {summaryData.uniqueVisitorsGrowth > 0 ? '+' : ''}
                  {fmt.number(summaryData.uniqueVisitorsGrowth, {
                    style: 'percent',
                    minimumFractionDigits: 1
                  })}
                </span>
              ) : null}{' '}
              {t('comparedToPrevious')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('conversionRate')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalClicks > 0
                ? fmt.number((totalVisitors / totalClicks) * 100, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1
                  })
                : '0.0'}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              {t('conversionRateDesc')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('activeLinks')}
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fmt.number(links.filter((l) => l.isActive).length)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('ofTotal', {
                total: fmt.number(linksData?.meta?.total || links.length)
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card className="border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle>{t('charts.clicksOverTime')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
            {chartDailyData.length > 0 ? (
              <ClicksChart data={chartDailyData} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                {t('empty.noData')}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/60 bg-card/90">
            <CardHeader>
              <CardTitle>{t('charts.topCountries')}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
              {breakdownLoading ? (
                <ChartSkeleton />
              ) : chartCountriesData.length > 0 ? (
                <CountriesChart data={chartCountriesData} />
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  {t('empty.noData')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/90">
            <CardHeader>
              <CardTitle>{t('charts.deviceBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
              {breakdownLoading ? (
                <ChartSkeleton />
              ) : chartDevicesData.length > 0 ? (
                <DevicesChart data={chartDevicesData} />
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  {t('empty.noData')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle>{t('charts.topReferrers')}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
            {breakdownLoading ? (
              <ChartSkeleton />
            ) : chartReferrersData.length > 0 ? (
              <ReferrersChart data={chartReferrersData} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                {t('empty.noData')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
