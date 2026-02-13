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
import type { DailyStats } from '@/types/analytics.types';

interface Props {
  data: DailyStats[];
}

export function ClicksChart({ data }: Props) {
  const t = useTranslations('Analytics.charts');
  const locale = useLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    if (!data) return [];
    // Sort by date ascending before mapping
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted.map((item) => ({
      date: new Date(item.date).toLocaleDateString(intlLocale, {
        month: 'short',
        day: 'numeric'
      }),
      clicks: item.clicks,
      uniqueVisitors: item.uniqueVisitors
    }));
  }, [data, intlLocale]);

  return (
    <div
      className="h-[300px] w-full"
      role="img"
      aria-label={t('clicksChartAriaLabel')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line
            type="monotone"
            dataKey="clicks"
            name={t('clicks')}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="uniqueVisitors"
            name={t('uniqueVisitors')}
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
