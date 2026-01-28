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

  // Get user's links
  const {
    data: linksData,
    isLoading: linksLoading,
    isError: linksError,
    error: linksErrorDetails,
    refetch: refetchLinks
  } = useLinks({
    perPage: 100
  });

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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('overviewDesc')}</p>
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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('overviewDesc')}</p>
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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('overviewDesc')}</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('overviewDesc')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
            <SelectTrigger className="w-50">
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
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-40">
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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

      {/* Charts */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.clicksOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartDailyData.length > 0 ? (
              <ClicksChart data={chartDailyData} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                {t('empty.noData')}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('charts.topCountries')}</CardTitle>
            </CardHeader>
            <CardContent>
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

          <Card>
            <CardHeader>
              <CardTitle>{t('charts.deviceBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
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

        <Card>
          <CardHeader>
            <CardTitle>{t('charts.topReferrers')}</CardTitle>
          </CardHeader>
          <CardContent>
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
