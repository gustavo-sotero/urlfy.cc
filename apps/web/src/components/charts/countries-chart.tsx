// src/components/charts/countries-chart.tsx
'use client';

import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useIsMobile } from '@/lib/hooks/use-mobile';

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c'
];

interface Props {
  data: Array<{
    code?: string;
    country?: string;
    name?: string;
    countryName?: string;
    clicks: number;
  }>;
}

export function CountriesChart({ data }: Props) {
  const t = useTranslations('Analytics.charts');
  const isMobile = useIsMobile();

  const topCountries = data.slice(0, isMobile ? 6 : 10).map((item) => ({
    country: item.country || item.code || '',
    countryName:
      item.countryName || item.name || item.country || item.code || 'Unknown',
    clicks: item.clicks
  }));
  const truncate = (value: string, max = isMobile ? 8 : 14) =>
    value.length > max ? `${value.slice(0, max)}…` : value;

  if (topCountries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground sm:h-72">
        {t('noData')}
      </div>
    );
  }

  return (
    <div className="h-64 sm:h-72" role="img" aria-label={t('topCountries')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topCountries}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            dataKey="countryName"
            type="category"
            width={isMobile ? 56 : 88}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => truncate(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value) => [value ?? 0, t('clicks')]}
          />
          <Bar dataKey="clicks" radius={[0, 4, 4, 0]}>
            {topCountries.map((entry, index) => (
              <Cell
                key={`cell-${entry.country}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
