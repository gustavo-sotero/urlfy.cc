// src/components/charts/clicks-chart.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { DailyStats } from '@/types/analytics.types';

interface Props {
  data: DailyStats[];
}

export function ClicksChart({ data }: Props) {
  const t = useTranslations('Analytics.charts');
  const locale = useLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted.map((item) => ({
      date: new Date(item.date).toLocaleDateString(intlLocale, {
        month: isMobile ? 'numeric' : 'short',
        day: 'numeric'
      }),
      clicks: item.clicks,
      uniqueVisitors: item.uniqueVisitors
    }));
  }, [data, intlLocale, isMobile]);

  return (
    <div
      className="h-64 w-full sm:h-80"
      role="img"
      aria-label={t('clicksChartAriaLabel')}
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          {t('noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 4,
              right: isMobile ? 8 : 16,
              left: isMobile ? -18 : -8,
              bottom: 4
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={isMobile ? 20 : 32}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              width={isMobile ? 28 : 36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: isMobile ? '12px' : '20px',
                fontSize: isMobile ? '11px' : '12px'
              }}
            />
            <Line
              type="monotone"
              dataKey="clicks"
              name={t('clicks')}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={isMobile ? false : { r: 3 }}
              activeDot={{ r: isMobile ? 4 : 5 }}
            />
            <Line
              type="monotone"
              dataKey="uniqueVisitors"
              name={t('uniqueVisitors')}
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={isMobile ? false : { r: 3 }}
              activeDot={{ r: isMobile ? 4 : 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
